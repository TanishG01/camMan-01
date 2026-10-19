const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Fest = require('../../src/models/Fest');
const Equipment = require('../../src/models/Equipment');
const EquipmentAssignment = require('../../src/models/EquipmentAssignment');

let mongoServer;
let adminCookie;
let adminUser;
let testFest;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_admin', email: 'admin@festops.local', name: 'Admin One' });
  adminCookie = adminRes.headers['set-cookie'];
  adminUser = adminRes.body.data.user;

  testFest = await Fest.create({
    name: 'Oasis 2026',
    startDate: new Date('2026-10-20'),
    endDate: new Date('2026-10-24'),
    createdBy: adminUser._id
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Equipment Lifecycle & Concurrency (Case 8 & Case 5)', () => {
  test('Case 8: Concurrent allocations of the same camera result in exactly one 200 and one 409', async () => {
    // 1. Create available camera
    const camera = await Equipment.create({
      equipmentId: 'CAM-RACE-01',
      category: 'camera',
      brandModel: 'Sony A7 IV',
      status: 'available',
      addedBy: adminUser._id
    });

    const holder1 = new mongoose.Types.ObjectId();
    const holder2 = new mongoose.Types.ObjectId();

    // 2. Fire 2 concurrent allocation requests simultaneously
    const req1 = request(app)
      .post(`/api/v1/equipment/${camera._id}/allocate`)
      .set('Cookie', adminCookie)
      .send({
        festId: testFest._id,
        holderId: holder1,
        expectedReturnTime: new Date('2026-10-21T22:00:00Z')
      });

    const req2 = request(app)
      .post(`/api/v1/equipment/${camera._id}/allocate`)
      .set('Cookie', adminCookie)
      .send({
        festId: testFest._id,
        holderId: holder2,
        expectedReturnTime: new Date('2026-10-21T22:00:00Z')
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.message).toMatch(/is no longer available/);

    // Verify exactly one allocation in DB
    const allocations = await EquipmentAssignment.find({ equipmentId: camera._id });
    expect(allocations.length).toBe(1);

    const refreshedCamera = await Equipment.findById(camera._id);
    expect(refreshedCamera.status).toBe('allocated');
  });

  test('Case 5: Camera return does not return SD card', async () => {
    const camera = await Equipment.create({
      equipmentId: 'CAM-IND-02',
      category: 'camera',
      brandModel: 'Canon R6',
      status: 'checked_out',
      currentCustodianId: adminUser._id,
      addedBy: adminUser._id
    });

    const sdCard = await Equipment.create({
      equipmentId: 'SD-IND-02',
      category: 'sd_card',
      brandModel: 'ProGrade 128GB',
      status: 'checked_out',
      currentCustodianId: adminUser._id,
      addedBy: adminUser._id
    });

    // Return camera via API
    const returnRes = await request(app)
      .post(`/api/v1/equipment/${camera._id}/return`)
      .set('Cookie', adminCookie)
      .send({ conditionAtReturn: 'good', returnNotes: 'Camera back in locker' });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.equipment.status).toBe('available');

    // Verify SD card status in DB
    const refreshedSd = await Equipment.findById(sdCard._id);
    expect(refreshedSd.status).toBe('checked_out');
    expect(String(refreshedSd.currentCustodianId)).toBe(String(adminUser._id));
  });

  test('POST /api/v1/equipment/:id/take - allows member to take available camera and tracks assignment & manager', async () => {
    // 1. Create an available camera
    const camera = await Equipment.create({
      equipmentId: 'CAM-TAKE-01',
      category: 'camera',
      brandModel: 'Nikon Z8',
      status: 'available',
      addedBy: adminUser._id
    });

    // 2. Take camera directly
    const takeRes = await request(app)
      .post(`/api/v1/equipment/${camera._id}/take`)
      .set('Cookie', adminCookie)
      .send({
        festId: testFest._id,
        checkoutNotes: 'Taking for opening ceremony',
        expectedReturnTime: new Date(Date.now() + 4 * 3600000).toISOString()
      });

    expect(takeRes.status).toBe(200);
    expect(takeRes.body.data.equipment.status).toBe('checked_out');
    expect(String(takeRes.body.data.equipment.currentCustodianId._id)).toBe(String(adminUser._id));
    expect(String(takeRes.body.data.assignment.assignedHolderId._id)).toBe(String(adminUser._id));
    expect(String(takeRes.body.data.assignment.issuedById._id)).toBe(String(adminUser._id));

    // 3. Verify in listEquipment that activeAssignment and manager (addedBy) are populated
    const listRes = await request(app)
      .get('/api/v1/equipment')
      .set('Cookie', adminCookie);

    expect(listRes.status).toBe(200);
    const listedCam = listRes.body.data.equipment.find(e => e.equipmentId === 'CAM-TAKE-01');
    expect(listedCam).toBeDefined();
    expect(listedCam.status).toBe('checked_out');
    expect(listedCam.currentCustodianId.name).toBe(adminUser.name);
    expect(listedCam.addedBy.name).toBe(adminUser.name);
    expect(listedCam.activeAssignment).toBeDefined();
    expect(String(listedCam.activeAssignment.assignedHolderId._id)).toBe(String(adminUser._id));

    // 4. Taking again should throw 409 conflict
    const conflictRes = await request(app)
      .post(`/api/v1/equipment/${camera._id}/take`)
      .set('Cookie', adminCookie)
      .send({});

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.message).toMatch(/already checked out/);
  });
});
