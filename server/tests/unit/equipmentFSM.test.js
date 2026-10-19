const { checkoutEquipment, returnEquipment } = require('../../src/services/equipmentService');
const Equipment = require('../../src/models/Equipment');
const EquipmentAssignment = require('../../src/models/EquipmentAssignment');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Equipment.deleteMany({});
  await EquipmentAssignment.deleteMany({});
});

describe('Equipment FSM Transitions', () => {
  test('checkout fails with 400 if equipment is in available (unallocated) status', async () => {
    const item = await Equipment.create({
      equipmentId: 'CAM-FSM-01',
      category: 'camera',
      brandModel: 'Sony A7 IV',
      status: 'available',
      addedBy: new mongoose.Types.ObjectId()
    });

    await expect(
      checkoutEquipment(item._id, {}, { _id: new mongoose.Types.ObjectId() })
    ).rejects.toThrow(/must be in "allocated" status/);
  });

  test('return transitions to maintenance if condition is damaged', async () => {
    const item = await Equipment.create({
      equipmentId: 'CAM-FSM-02',
      category: 'camera',
      brandModel: 'Sony A7 IV',
      status: 'checked_out',
      addedBy: new mongoose.Types.ObjectId()
    });

    const result = await returnEquipment(
      item._id,
      { conditionAtReturn: 'damaged', returnNotes: 'Dropped lens mount cracked' },
      { _id: new mongoose.Types.ObjectId() }
    );

    expect(result.equipment.status).toBe('maintenance');
    expect(result.equipment.condition).toBe('damaged');
  });

  test('camera and SD card remain completely independent during returns', async () => {
    const camera = await Equipment.create({
      equipmentId: 'CAM-IND-01',
      category: 'camera',
      brandModel: 'Sony A7 IV',
      status: 'checked_out',
      currentCustodianId: new mongoose.Types.ObjectId(),
      addedBy: new mongoose.Types.ObjectId()
    });

    const sdCard = await Equipment.create({
      equipmentId: 'SD-IND-01',
      category: 'sd_card',
      brandModel: 'SanDisk 128GB',
      status: 'checked_out',
      currentCustodianId: camera.currentCustodianId,
      addedBy: new mongoose.Types.ObjectId()
    });

    // Return camera only
    await returnEquipment(
      camera._id,
      { conditionAtReturn: 'good', returnNotes: 'Camera returned' },
      { _id: new mongoose.Types.ObjectId() }
    );

    const refreshedCam = await Equipment.findById(camera._id);
    const refreshedSd = await Equipment.findById(sdCard._id);

    expect(refreshedCam.status).toBe('available');
    expect(refreshedCam.currentCustodianId).toBeNull();

    // SD Card MUST remain checked_out
    expect(refreshedSd.status).toBe('checked_out');
    expect(String(refreshedSd.currentCustodianId)).toBe(String(camera.currentCustodianId));
  });
});
