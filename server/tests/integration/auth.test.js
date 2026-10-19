const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const AuditLog = require('../../src/models/AuditLog');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
});

describe('Authentication & RBAC API Endpoints', () => {
  test('POST /api/v1/auth/login - creates first user as admin and sets cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        idToken: 'mock_admin',
        email: 'coordinator@festops.local',
        name: 'Chief Coordinator'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('coordinator@festops.local');
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.seniority).toBe('4th_year');

    // Cookie verification
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
  });

  test('POST /api/v1/auth/login - subsequent users are created as junior', async () => {
    // Create first admin
    await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });

    // Second user
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_junior', email: 'junior@festops.local', name: 'Freshman Member' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('junior');
    expect(res.body.data.user.seniority).toBe('1st_year');
  });

  test('GET /api/v1/auth/me - returns user profile with valid cookie', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });

    const cookie = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('admin@festops.local');
  });

  test('GET /api/v1/auth/me - returns 401 when no cookie is sent', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/logout - clears session cookie', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });

    const cookie = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers['set-cookie'][0]).toMatch(/token=;/);
  });

  test('PATCH /api/v1/auth/users/:userId/role - admin can promote junior to senior', async () => {
    // 1. Create admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });
    const adminCookie = adminLogin.headers['set-cookie'];

    // 2. Create junior
    const juniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_junior', email: 'junior@festops.local' });
    const juniorId = juniorLogin.body.data.user._id;

    // 3. Admin promotes junior to senior
    const promoteRes = await request(app)
      .patch(`/api/v1/auth/users/${juniorId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'senior', seniority: '2nd_year', reason: 'Promoted to team lead' });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.data.user.role).toBe('senior');
    expect(promoteRes.body.data.user.seniority).toBe('2nd_year');

    // 4. Verify AuditLog was created
    const audit = await AuditLog.findOne({ action: 'USER_ROLE_CHANGED' });
    expect(audit).toBeDefined();
    expect(audit.reason).toContain('Promoted to team lead');
  });

  test('PATCH /api/v1/auth/users/:userId/role - junior cannot change roles (returns 403)', async () => {
    // 1. Create admin
    await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });

    // 2. Create junior
    const juniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_junior', email: 'junior@festops.local' });
    const juniorCookie = juniorLogin.headers['set-cookie'];
    const juniorId = juniorLogin.body.data.user._id;

    // 3. Junior attempts self-promotion
    const res = await request(app)
      .patch(`/api/v1/auth/users/${juniorId}/role`)
      .set('Cookie', juniorCookie)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/users - admin can add member directly to team roster', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });
    const adminCookie = adminLogin.headers['set-cookie'];

    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Rahul Sharma',
        email: 'rahul@festops.local',
        role: 'junior',
        seniority: '2nd_year',
        skills: ['photography', 'videography'],
        phone: '+91 9876543210'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.name).toBe('Rahul Sharma');
    expect(res.body.data.user.email).toBe('rahul@festops.local');
    expect(res.body.data.user.seniority).toBe('2nd_year');
    expect(res.body.data.user.skills).toContain('videography');

    // Verify AuditLog
    const audit = await AuditLog.findOne({ action: 'USER_CREATED' });
    expect(audit).toBeDefined();
  });

  test('PATCH /api/v1/auth/me - logged in user can update own profile, skills, and phone', async () => {
    const juniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_junior', email: 'member@festops.local', name: 'Original Name' });
    const juniorCookie = juniorLogin.headers['set-cookie'];

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', juniorCookie)
      .send({
        name: 'Updated Member Name',
        phone: '1234567890',
        seniority: '2nd_year',
        skills: ['photography', 'editing', 'drone']
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Updated Member Name');
    expect(res.body.data.user.phone).toBe('1234567890');
    expect(res.body.data.user.skills).toContain('drone');

    // Verify AuditLog
    const audit = await AuditLog.findOne({ action: 'USER_UPDATED' });
    expect(audit).toBeDefined();
  });

  test('DELETE /api/v1/auth/users/:userId - coordinator can delete junior member', async () => {
    // 1. Create Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });

    // 2. Create Senior Coordinator
    const seniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_senior', email: 'coordinator@festops.local' });
    const seniorCookie = seniorLogin.headers['set-cookie'];
    await User.findByIdAndUpdate(seniorLogin.body.data.user._id, { role: 'senior', seniority: '3rd_year' });

    // 3. Create Junior Member
    const juniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_junior', email: 'junior@festops.local', name: 'Junior Member' });
    const juniorId = juniorLogin.body.data.user._id;

    // 4. Coordinator deletes junior
    const delRes = await request(app)
      .delete(`/api/v1/auth/users/${juniorId}`)
      .set('Cookie', seniorCookie);

    expect(delRes.status).toBe(200);

    // 5. Verify user is inactive in DB
    const deletedUser = await User.findById(juniorId);
    expect(deletedUser.isActive).toBe(false);

    // 6. Verify omitted from active listUsers
    const listRes = await request(app)
      .get('/api/v1/auth/users')
      .set('Cookie', seniorCookie);

    const found = listRes.body.data.users.some(u => String(u._id) === String(juniorId));
    expect(found).toBe(false);

    // 7. Verify AuditLog
    const audit = await AuditLog.findOne({ action: 'USER_DELETED' });
    expect(audit).toBeDefined();
    expect(String(audit.targetEntity.entityId)).toBe(String(juniorId));
  });

  test('DELETE /api/v1/auth/users/:userId - cannot delete oneself and coordinator cannot delete admin', async () => {
    // 1. Create Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_admin', email: 'admin@festops.local' });
    const adminCookie = adminLogin.headers['set-cookie'];
    const adminId = adminLogin.body.data.user._id;

    // 2. Create Senior Coordinator
    const seniorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_senior', email: 'coordinator@festops.local' });
    const seniorCookie = seniorLogin.headers['set-cookie'];
    await User.findByIdAndUpdate(seniorLogin.body.data.user._id, { role: 'senior', seniority: '3rd_year' });

    // 3. Senior attempts to delete Admin -> 403
    const forbiddenRes = await request(app)
      .delete(`/api/v1/auth/users/${adminId}`)
      .set('Cookie', seniorCookie);

    expect(forbiddenRes.status).toBe(403);

    // 4. Admin attempts to delete themselves -> 400
    const selfDelRes = await request(app)
      .delete(`/api/v1/auth/users/${adminId}`)
      .set('Cookie', adminCookie);

    expect(selfDelRes.status).toBe(400);
  });
});
