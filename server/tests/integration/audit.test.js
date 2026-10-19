const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const AuditLog = require('../../src/models/AuditLog');

let mongoServer;
let adminCookie;
let juniorCookie;
let adminUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_admin', email: 'admin@festops.local', name: 'Chief Coordinator' });
  adminCookie = adminRes.headers['set-cookie'];
  adminUser = adminRes.body.data.user;

  const juniorRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_junior', email: 'junior@festops.local', name: 'Junior Photographer' });
  juniorCookie = juniorRes.headers['set-cookie'];

  // Seed sample audit log
  await AuditLog.create({
    actorId: adminUser._id,
    action: 'USER_ROLE_CHANGED',
    targetEntity: { entityType: 'User', entityId: adminUser._id },
    reason: 'Initial setup test promotion',
    ipAddress: '127.0.0.1',
    timestamp: new Date()
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Audit Logs & CSV Export (Immutable Audit Trail)', () => {
  test('GET /api/v1/audit - admin retrieves paginated audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/v1/audit - junior access denied (403)', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', juniorCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/v1/audit/:id - immutable audit trail (no DELETE endpoint exists)', async () => {
    const log = await AuditLog.findOne();
    const res = await request(app)
      .delete(`/api/v1/audit/${log._id}`)
      .set('Cookie', adminCookie);

    // Express default 404 for nonexistent route
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/audit/export - streams valid CSV export', async () => {
    const res = await request(app)
      .get('/api/v1/audit/export')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Timestamp,Actor Name,Actor Email,Action,Entity Type,Entity ID,Reason,IP Address');
    expect(res.text).toContain('USER_ROLE_CHANGED');
    expect(res.text).toContain('Initial setup test promotion');
  });
});
