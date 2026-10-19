const request = require('supertest');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Fest = require('../../src/models/Fest');
const Venue = require('../../src/models/Venue');
const Event = require('../../src/models/Event');
const EventAssignment = require('../../src/models/EventAssignment');
const Equipment = require('../../src/models/Equipment');
const EquipmentAssignment = require('../../src/models/EquipmentAssignment');
const CoverageRecord = require('../../src/models/CoverageRecord');

let mongoServer;
let adminCookie;
let seniorCookie;
let juniorCookie;
let adminUser;
let seniorUser;
let juniorUser;
let testFest;
let testVenue;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);

  // Create admin
  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_admin', email: 'admin@festops.local', name: 'Fest Admin' });
  adminCookie = adminRes.headers['set-cookie'];
  adminUser = adminRes.body.data.user;

  // Create senior coordinator
  const seniorRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_senior', email: 'senior@festops.local', name: 'Fest Coordinator' });
  seniorCookie = seniorRes.headers['set-cookie'];
  seniorUser = seniorRes.body.data.user;

  // Create junior
  const juniorRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_junior', email: 'junior@festops.local', name: 'Team Junior' });
  juniorCookie = juniorRes.headers['set-cookie'];
  juniorUser = juniorRes.body.data.user;

  // Create initial fest
  testFest = await Fest.create({
    name: 'Oasis 2026',
    startDate: new Date('2026-10-20'),
    endDate: new Date('2026-10-24'),
    createdBy: adminUser._id
  });

  // Create initial venue
  testVenue = await Venue.create({
    festId: testFest._id,
    name: 'Main Auditorium',
    travelBufferMinutes: 10,
    setupBufferMinutes: 15
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Fest, Venue & Event Management Endpoints', () => {
  test('POST /api/v1/fests - admin creates fest', async () => {
    const res = await request(app)
      .post('/api/v1/fests')
      .set('Cookie', adminCookie)
      .send({
        name: 'Incident 2027',
        startDate: '2027-02-10',
        endDate: '2027-02-14',
        description: 'Annual cultural festival'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.fest.name).toBe('Incident 2027');
  });

  test('POST /api/v1/fests - junior cannot create fest (403)', async () => {
    const res = await request(app)
      .post('/api/v1/fests')
      .set('Cookie', juniorCookie)
      .send({
        name: 'Unauthorized Fest',
        startDate: '2027-02-10',
        endDate: '2027-02-14'
      });

    expect(res.status).toBe(403);
  });

  test('POST /api/v1/fests/:festId/events - manual event creation as admin', async () => {
    const res = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events`)
      .set('Cookie', adminCookie)
      .send({
        name: 'Battle of the Bands',
        category: 'Music',
        date: '2026-10-21',
        startTime: '2026-10-21T18:00:00.000Z',
        endTime: '2026-10-21T21:00:00.000Z',
        venueId: testVenue._id,
        teamSizeRequired: 3,
        priority: 'critical'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.event.name).toBe('Battle of the Bands');
    expect(res.body.data.event.status).toBe('scheduled');
  });

  test('POST /api/v1/fests/:festId/events/import/preview & commit - Excel upload workflow', async () => {
    // Generate an in-memory .xlsx buffer
    const wb = xlsx.utils.book_new();
    const wsData = [
      ['Event Name', 'Category', 'Date', 'Start Time', 'End Time', 'Venue', 'Team Size', 'Priority'],
      ['Inauguration', 'Ceremony', '2026-10-20', '09:00', '11:00', 'Main Auditorium', '2', 'high'],
      ['Dance Night', 'Dance', '2026-10-20', '19:00', '22:00', 'SAC Amphitheatre', '4', 'critical'],
      ['Invalid Event', 'Music', '2026-10-20', '15:00', '14:00', 'Main Auditorium', '2', 'medium'] // start > end error
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Schedule');
    const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 1. Upload for Preview
    const previewRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/import/preview`)
      .set('Cookie', adminCookie)
      .attach('file', xlsxBuffer, 'schedule.xlsx');

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.totalRows).toBe(3);
    expect(previewRes.body.data.validCount).toBe(1); // Inauguration
    expect(previewRes.body.data.warningCount).toBe(1); // Dance Night (new venue warning)
    expect(previewRes.body.data.errorCount).toBe(1); // Invalid Event (start > end)

    const token = previewRes.body.data.previewToken;
    expect(token).toBeDefined();

    // 2. Commit valid rows (rows 0 and 1)
    const commitRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/import/commit`)
      .set('Cookie', adminCookie)
      .send({
        previewToken: token,
        rowIndexes: [0, 1]
      });

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.data.importedCount).toBe(2);

    // Verify SAC Amphitheatre venue was auto-created
    const autoVenue = await Venue.findOne({ festId: testFest._id, name: 'SAC Amphitheatre' });
    expect(autoVenue).toBeDefined();
  });

  test('POST /api/v1/fests/:festId/events/import/preview - handles Excel fractional times (0.375, 0.5) and ordinal dates (10th December)', async () => {
    const wb = xlsx.utils.book_new();
    const wsData = [
      ['Category', 'Date', 'Start Time', 'End Time', 'Event Name', 'Venue'],
      ['Ceremony', '10th December', 0.375, 0.5, 'Road Show', 'Road in front of Yamuna Gate']
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Schedule');
    const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const previewRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/import/preview`)
      .set('Cookie', adminCookie)
      .attach('file', xlsxBuffer, 'schedule_user.xlsx');

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.totalRows).toBe(1);
    expect(previewRes.body.data.errorCount).toBe(0);
    expect(previewRes.body.data.warningCount).toBe(1);
    const row = previewRes.body.data.rows[0];
    expect(row.status).toBe('warning');
    expect(row.startTime).toBe('09:00');
    expect(row.endTime).toBe('12:00');
    expect(row.date).toBe('2026-12-10');
    expect(row.warnings[0]).toContain('Road in front of Yamuna Gate');

    // Commit import
    const commitRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/import/commit`)
      .set('Cookie', adminCookie)
      .send({
        previewToken: previewRes.body.data.previewToken,
        rowIndexes: [0]
      });

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.data.importedCount).toBe(1);

    const createdEvent = await Event.findOne({ festId: testFest._id, name: 'Road Show' });
    expect(createdEvent).toBeDefined();
    expect(createdEvent.date.toISOString()).toContain('2026-12-10');
  });

  test('Case 1: POST /api/v1/fests/:festId/events/:eventId/delay - preserves assignment & notifies', async () => {
    // 1. Create event A (10am - 12pm) and event B (12:30pm - 2pm)
    const eventA = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Morning Keynote',
      category: 'Talk',
      date: new Date('2026-10-22'),
      startTime: new Date('2026-10-22T10:00:00Z'),
      endTime: new Date('2026-10-22T12:00:00Z'),
      createdBy: adminUser._id
    });

    const eventB = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Afternoon Panel',
      category: 'Talk',
      date: new Date('2026-10-22'),
      startTime: new Date('2026-10-22T12:30:00Z'),
      endTime: new Date('2026-10-22T14:00:00Z'),
      createdBy: adminUser._id
    });

    // Assign juniorUser to both
    await EventAssignment.create({
      festId: testFest._id,
      eventId: eventA._id,
      memberId: juniorUser._id,
      roleInEvent: 'photographer',
      status: 'approved'
    });

    await EventAssignment.create({
      festId: testFest._id,
      eventId: eventB._id,
      memberId: juniorUser._id,
      roleInEvent: 'photographer',
      status: 'approved'
    });

    // 2. Delay event A to end at 1:00pm (overlaps with event B start at 12:30pm)
    const delayRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/${eventA._id}/delay`)
      .set('Cookie', adminCookie)
      .send({
        newEndTime: '2026-10-22T13:00:00Z',
        reason: 'Speaker arrived late'
      });

    expect(delayRes.status).toBe(200);
    expect(delayRes.body.data.event.status).toBe('delayed');
    expect(delayRes.body.data.conflictsDetected).toBe(1);

    // Verify original assignment was NOT automatically erased
    const assignA = await EventAssignment.findOne({ eventId: eventA._id, memberId: juniorUser._id });
    expect(assignA).toBeDefined();
    expect(assignA.status).toBe('approved');
  });

  test('Case 4: POST /api/v1/fests/:festId/events/:eventId/cancel - does NOT return checked out equipment', async () => {
    // 1. Create event
    const event = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Evening Concert',
      category: 'Music',
      date: new Date('2026-10-23'),
      startTime: new Date('2026-10-23T19:00:00Z'),
      endTime: new Date('2026-10-23T22:00:00Z'),
      createdBy: adminUser._id
    });

    // 2. Create camera and checkout for this event
    const camera = await Equipment.create({
      equipmentId: 'CAM-CANCEL-TEST',
      category: 'camera',
      brandModel: 'Sony A7 IV',
      status: 'checked_out',
      currentCustodianId: juniorUser._id,
      addedBy: adminUser._id
    });

    const eqAssign = await EquipmentAssignment.create({
      festId: testFest._id,
      equipmentId: camera._id,
      eventId: event._id,
      assignedHolderId: juniorUser._id,
      status: 'checked_out',
      expectedReturnTime: new Date('2026-10-23T23:00:00Z')
    });

    // 3. Cancel the event
    const cancelRes = await request(app)
      .post(`/api/v1/fests/${testFest._id}/events/${event._id}/cancel`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Rain washed out the venue' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.event.status).toBe('cancelled');

    // 4. Verify equipment is STILL checked out
    const refreshedCamera = await Equipment.findById(camera._id);
    expect(refreshedCamera.status).toBe('checked_out');
    expect(String(refreshedCamera.currentCustodianId)).toBe(String(juniorUser._id));

    const refreshedEqAssign = await EquipmentAssignment.findById(eqAssign._id);
    expect(refreshedEqAssign.status).toBe('checked_out');
  });

  test('DELETE /api/v1/fests/:festId/events/:eventId - junior forbidden (403)', async () => {
    const event = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Event To Protect',
      category: 'Dance',
      date: new Date('2026-10-23'),
      startTime: new Date('2026-10-23T14:00:00Z'),
      endTime: new Date('2026-10-23T16:00:00Z'),
      createdBy: adminUser._id
    });

    const res = await request(app)
      .delete(`/api/v1/fests/${testFest._id}/events/${event._id}`)
      .set('Cookie', juniorCookie);

    expect(res.status).toBe(403);
    const stillExists = await Event.findById(event._id);
    expect(stillExists).toBeDefined();
  });

  test('DELETE /api/v1/fests/:festId/events/:eventId - senior coordinator can delete event with cascading cleanup', async () => {
    const event = await Event.create({
      festId: testFest._id,
      venueId: testVenue._id,
      name: 'Event Coordinator Deletes',
      category: 'Art',
      date: new Date('2026-10-23'),
      startTime: new Date('2026-10-23T14:00:00Z'),
      endTime: new Date('2026-10-23T16:00:00Z'),
      createdBy: adminUser._id
    });

    const assign = await EventAssignment.create({
      festId: testFest._id,
      eventId: event._id,
      memberId: juniorUser._id,
      roleInEvent: 'photographer',
      status: 'approved'
    });

    const coverage = await CoverageRecord.create({
      festId: testFest._id,
      eventId: event._id,
      reportedBy: juniorUser._id
    });

    const res = await request(app)
      .delete(`/api/v1/fests/${testFest._id}/events/${event._id}`)
      .set('Cookie', seniorCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedEventId).toBe(String(event._id));

    expect(await Event.findById(event._id)).toBeNull();
    expect(await EventAssignment.findById(assign._id)).toBeNull();
    expect(await CoverageRecord.findById(coverage._id)).toBeNull();
  });

  test('DELETE /api/v1/fests/:festId - junior forbidden (403)', async () => {
    const festToProtect = await Fest.create({
      name: 'Fest To Protect',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-03'),
      createdBy: adminUser._id
    });

    const res = await request(app)
      .delete(`/api/v1/fests/${festToProtect._id}`)
      .set('Cookie', juniorCookie);

    expect(res.status).toBe(403);
    const stillExists = await Fest.findById(festToProtect._id);
    expect(stillExists).toBeDefined();
  });

  test('DELETE /api/v1/fests/:festId - senior coordinator can delete fest with cascading cleanup', async () => {
    const festToDelete = await Fest.create({
      name: 'Fest Coordinator Deletes',
      startDate: new Date('2026-11-05'),
      endDate: new Date('2026-11-07'),
      createdBy: seniorUser._id
    });

    const venue = await Venue.create({
      festId: festToDelete._id,
      name: 'Temporary Stage'
    });

    const event = await Event.create({
      festId: festToDelete._id,
      venueId: venue._id,
      name: 'Stage Inauguration',
      category: 'Ceremony',
      date: new Date('2026-11-05'),
      startTime: new Date('2026-11-05T10:00:00Z'),
      endTime: new Date('2026-11-05T12:00:00Z'),
      createdBy: seniorUser._id
    });

    const assign = await EventAssignment.create({
      festId: festToDelete._id,
      eventId: event._id,
      memberId: juniorUser._id,
      roleInEvent: 'photographer'
    });

    const res = await request(app)
      .delete(`/api/v1/fests/${festToDelete._id}`)
      .set('Cookie', seniorCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedFestId).toBe(String(festToDelete._id));

    expect(await Fest.findById(festToDelete._id)).toBeNull();
    expect(await Venue.findById(venue._id)).toBeNull();
    expect(await Event.findById(event._id)).toBeNull();
    expect(await EventAssignment.findById(assign._id)).toBeNull();
  });

  test('DELETE /api/v1/fests/:festId - admin can delete fest', async () => {
    const adminFest = await Fest.create({
      name: 'Admin Fest To Delete',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-03'),
      createdBy: adminUser._id
    });

    const res = await request(app)
      .delete(`/api/v1/fests/${adminFest._id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(await Fest.findById(adminFest._id)).toBeNull();
  });
});
