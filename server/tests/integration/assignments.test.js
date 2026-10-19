const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Fest = require('../../src/models/Fest');
const Venue = require('../../src/models/Venue');
const Event = require('../../src/models/Event');
const EventAssignment = require('../../src/models/EventAssignment');
const AuditLog = require('../../src/models/AuditLog');

let mongoServer;
let adminCookie;
let adminUser;
let seniorUser;
let juniorUser;
let testFest;
let testVenue;
let testEvent;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);

  // 1. Create Admin
  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_admin', email: 'admin@festops.local', name: 'Chief Coordinator' });
  adminCookie = adminRes.headers['set-cookie'];
  adminUser = adminRes.body.data.user;

  // 2. Create Senior
  const seniorRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_senior', email: 'senior@festops.local', name: 'Senior Lead' });
  seniorUser = seniorRes.body.data.user;
  await User.findByIdAndUpdate(seniorUser._id, { role: 'senior', seniority: '3rd_year' });

  // 3. Create Junior
  const juniorRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_junior', email: 'junior@festops.local', name: 'Junior Member' });
  juniorUser = juniorRes.body.data.user;

  // 4. Create Fest & Venue
  testFest = await Fest.create({
    name: 'Oasis 2026',
    startDate: new Date('2026-10-20'),
    endDate: new Date('2026-10-24'),
    createdBy: adminUser._id
  });

  testVenue = await Venue.create({
    festId: testFest._id,
    name: 'Auditorium Stage',
    travelBufferMinutes: 10,
    setupBufferMinutes: 15
  });

  testEvent = await Event.create({
    festId: testFest._id,
    venueId: testVenue._id,
    name: 'Rock Show',
    category: 'Music',
    date: new Date('2026-10-21'),
    startTime: new Date('2026-10-21T18:00:00Z'),
    endTime: new Date('2026-10-21T21:00:00Z'),
    teamSizeRequired: 2,
    createdBy: adminUser._id
  });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Assignment Engine & Mentorship Integration (Case 2)', () => {
  test('POST /api/v1/assignments/suggest - creates suggested assignments with mentor pairing', async () => {
    const res = await request(app)
      .post('/api/v1/assignments/suggest')
      .set('Cookie', adminCookie)
      .send({ eventId: testEvent._id });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestions.length).toBeGreaterThanOrEqual(1);

    // Verify suggestions exist in DB
    const dbAssignments = await EventAssignment.find({ eventId: testEvent._id });
    expect(dbAssignments.length).toBe(res.body.data.suggestions.length);

    // Verify NO 4th-year member was allocated as crew or mentor
    const assignedMemberIds = res.body.data.suggestions.map(s => String(s.memberId?._id || s.memberId));
    expect(assignedMemberIds).not.toContain(String(adminUser._id));
    const assignedMentorIds = res.body.data.suggestions
      .map(s => String(s.mentorId?._id || s.mentorId))
      .filter(id => id && id !== 'null' && id !== 'undefined');
    expect(assignedMentorIds).not.toContain(String(adminUser._id));
  });

  test('Case 2: POST /api/v1/assignments/:id/approve - flags isMentorNeeded when 1st-year has no mentor', async () => {
    // Clear previous assignments for this event
    await EventAssignment.deleteMany({ eventId: testEvent._id });

    // Manually create an assignment for juniorUser alone
    const unmentored = await EventAssignment.create({
      festId: testFest._id,
      eventId: testEvent._id,
      memberId: juniorUser._id,
      roleInEvent: 'photographer',
      status: 'suggested',
      mentorId: null
    });

    const res = await request(app)
      .post(`/api/v1/assignments/${unmentored._id}/approve`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.assignment.status).toBe('approved');
    expect(res.body.data.assignment.isMentorNeeded).toBe(true);
  });

  test('POST /api/v1/assignments/:id/assign-mentor - resolves isMentorNeeded flag', async () => {
    const assignment = await EventAssignment.findOne({
      memberId: juniorUser._id,
      isMentorNeeded: true
    });

    const res = await request(app)
      .post(`/api/v1/assignments/${assignment._id}/assign-mentor`)
      .set('Cookie', adminCookie)
      .send({ mentorId: seniorUser._id });

    expect(res.status).toBe(200);
    expect(res.body.data.assignment.isMentorNeeded).toBe(false);
    expect(String(res.body.data.assignment.mentorId)).toBe(String(seniorUser._id));
  });

  test('POST /api/v1/assignments/:id/reassign - preserves reassignmentHistory and audit', async () => {
    // Create new replacement user
    const replacement = await User.create({
      firebaseUid: 'mock_replacement',
      name: 'Replacement Senior',
      email: 'replace@festops.local',
      role: 'senior',
      seniority: '2nd_year'
    });

    const assignment = await EventAssignment.findOne({ eventId: testEvent._id, status: 'approved' });
    const originalMemberId = assignment.memberId;

    const res = await request(app)
      .post(`/api/v1/assignments/${assignment._id}/reassign`)
      .set('Cookie', adminCookie)
      .send({
        newMemberId: replacement._id,
        reason: 'Original member fell sick'
      });

    expect(res.status).toBe(200);
    expect(String(res.body.data.assignment.memberId)).toBe(String(replacement._id));

    // Verify history preserved
    expect(res.body.data.assignment.reassignmentHistory.length).toBe(1);
    expect(String(res.body.data.assignment.reassignmentHistory[0].originalMemberId)).toBe(String(originalMemberId));
    expect(res.body.data.assignment.reassignmentHistory[0].reason).toBe('Original member fell sick');

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'ASSIGNMENT_REASSIGNED' });
    expect(audit).toBeDefined();
    expect(audit.reason).toBe('Original member fell sick');
  });

  test('POST /api/v1/assignments & DELETE /api/v1/assignments/:id - coordinator directly allocates and removes member', async () => {
    // 0. Create a fresh event for direct allocation
    const directEvent = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Classical Solo',
      category: 'Music',
      date: new Date('2026-10-22'),
      startTime: new Date('2026-10-22T10:00:00Z'),
      endTime: new Date('2026-10-22T12:00:00Z'),
      teamSizeRequired: 1,
      createdBy: adminUser._id
    });

    // 1. Coordinator creates a direct event assignment
    const assignRes = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', adminCookie)
      .send({
        festId: testFest._id,
        eventId: directEvent._id,
        memberId: seniorUser._id,
        roleInEvent: 'lead_photographer'
      });

    expect(assignRes.status).toBe(201);
    expect(assignRes.body.data.assignment.memberId._id).toBe(String(seniorUser._id));
    expect(assignRes.body.data.assignment.roleInEvent).toBe('lead_photographer');
    expect(assignRes.body.data.assignment.status).toBe('approved');

    const assignmentId = assignRes.body.data.assignment._id;

    // 2. Remove assignment
    const delRes = await request(app)
      .delete(`/api/v1/assignments/${assignmentId}`)
      .set('Cookie', adminCookie);

    expect(delRes.status).toBe(200);

    const deleted = await EventAssignment.findById(assignmentId);
    expect(deleted).toBeNull();

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'ASSIGNMENT_REMOVED' });
    expect(audit).toBeDefined();
  });
});
