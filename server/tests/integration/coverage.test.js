const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Fest = require('../../src/models/Fest');
const Equipment = require('../../src/models/Equipment');
const CoverageRecord = require('../../src/models/CoverageRecord');
const FootageRecord = require('../../src/models/FootageRecord');

let mongoServer;
let adminCookie;
let adminUser;
let member1;
let member2;
let reporter;
let testFest;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ idToken: 'mock_admin', email: 'admin@festops.local', name: 'Fest Admin' });
  adminCookie = adminRes.headers['set-cookie'];
  adminUser = adminRes.body.data.user;

  // Create members
  member1 = await User.create({
    firebaseUid: 'm1',
    name: 'Photographer One',
    email: 'p1@festops.local',
    role: 'junior',
    seniority: '1st_year'
  });

  member2 = await User.create({
    firebaseUid: 'm2',
    name: 'Photographer Two',
    email: 'p2@festops.local',
    role: 'senior',
    seniority: '2nd_year'
  });

  reporter = await User.create({
    firebaseUid: 'rep',
    name: 'Desk Reporter',
    email: 'desk@festops.local',
    role: 'senior',
    seniority: '3rd_year'
  });

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

describe('Coverage Records, Unplanned Reports & Footage Pipeline (Case 7 & Case 6)', () => {
  test('Case 7: POST /api/v1/coverage/unplanned - multi-contributor attribution preserved', async () => {
    // Desk Reporter logs in
    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ idToken: 'mock_senior', email: 'desk@festops.local' });
    const repCookie = repLogin.headers['set-cookie'];

    const res = await request(app)
      .post('/api/v1/coverage/unplanned')
      .set('Cookie', repCookie)
      .send({
        festId: testFest._id,
        unplannedDetails: {
          eventName: 'Flash Mob at Rotunda',
          venueName: 'Rotunda Stairs',
          eventDate: new Date('2026-10-21')
        },
        actualContributors: [
          { memberId: member1._id, roleInEvent: 'lead_photographer', contributionNotes: 'Captured front angles' },
          { memberId: member2._id, roleInEvent: 'videographer', contributionNotes: '4K video footage' }
        ],
        actualDurationMinutes: 45,
        deliverablesProduced: ['photos', 'videos'],
        notes: 'Surprise flash mob, highly successful'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.report.isUnplanned).toBe(true);
    expect(String(res.body.data.report.reportedBy)).toBe(String(reporter._id));

    // Verify both contributors are recorded, and reporter is NOT auto-added as photographer
    const contributors = res.body.data.report.actualContributors;
    expect(contributors.length).toBe(2);
    const contributorIds = contributors.map(c => String(c.memberId));
    expect(contributorIds).toContain(String(member1._id));
    expect(contributorIds).toContain(String(member2._id));
    expect(contributorIds).not.toContain(String(reporter._id));

    // Validate coverage as admin
    const valRes = await request(app)
      .post(`/api/v1/coverage/${res.body.data.report._id}/validate`)
      .set('Cookie', adminCookie)
      .send({ validationStatus: 'approved' });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.coverage.validationStatus).toBe('approved');
  });

  test('Case 6: Footage corruption locks verification until explicitly resolved', async () => {
    // 1. Create SD Card and Coverage record
    const sdCard = await Equipment.create({
      equipmentId: 'SD-FAIL-01',
      category: 'sd_card',
      brandModel: 'SanDisk 128GB Extreme',
      status: 'checked_out',
      currentCustodianId: member1._id,
      addedBy: adminUser._id
    });

    const coverage = await CoverageRecord.create({
      festId: testFest._id,
      isUnplanned: false,
      actualContributors: [{ memberId: member1._id }],
      reportedBy: member1._id
    });

    const footage = await FootageRecord.create({
      festId: testFest._id,
      coverageRecordId: coverage._id,
      sdCardId: sdCard._id,
      currentCustodianId: member1._id,
      handoverStatus: 'handed_over',
      backupStatus: 'backed_up',
      verificationStatus: 'unverified'
    });

    // 2. Flag corruption issue
    const flagRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/flag-issue`)
      .set('Cookie', adminCookie)
      .send({
        issueType: 'corruption',
        description: 'Read error at block 4096, 12 photos damaged'
      });

    expect(flagRes.status).toBe(200);
    expect(flagRes.body.data.footage.verificationStatus).toBe('issue_recheck_required');
    expect(flagRes.body.data.footage.issues.length).toBe(1);

    // 3. Attempt to verify footage -> MUST FAIL with 400
    const verifyBlockedRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/verify`)
      .set('Cookie', adminCookie);

    expect(verifyBlockedRes.status).toBe(400);
    expect(verifyBlockedRes.body.message).toMatch(/Open corruption\/backup issues must be resolved first/);

    // 4. Resolve the issue
    const resolveRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/resolve-issue/0`)
      .set('Cookie', adminCookie)
      .send({ resolutionNotes: 'Card recovered with PhotoRec software' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.footage.issues[0].isResolved).toBe(true);

    // 5. Verify footage again -> MUST SUCCEED with 200
    const verifySuccessRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/verify`)
      .set('Cookie', adminCookie);

    expect(verifySuccessRes.status).toBe(200);
    expect(verifySuccessRes.body.data.footage.verificationStatus).toBe('verified');
  });

  test('Case 5: SD card handover notes do NOT mark status as handed_over', async () => {
    const sdCard = await Equipment.create({
      equipmentId: 'SD-NOTE-01',
      category: 'sd_card',
      brandModel: 'ProGrade 64GB',
      status: 'checked_out',
      currentCustodianId: member1._id,
      addedBy: adminUser._id
    });

    const coverage = await CoverageRecord.create({
      festId: testFest._id,
      reportedBy: member1._id
    });

    const footage = await FootageRecord.create({
      festId: testFest._id,
      coverageRecordId: coverage._id,
      sdCardId: sdCard._id,
      currentCustodianId: member1._id,
      handoverStatus: 'not_yet_handed_over'
    });

    // Initiate handover with notes
    const initRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/initiate-handover`)
      .set('Cookie', adminCookie)
      .send({
        handedOverToId: adminUser._id,
        handoverNotes: 'Left SD card in envelope on coordinator desk'
      });

    expect(initRes.status).toBe(200);
    expect(initRes.body.data.footage.handoverStatus).toBe('handover_pending');
    expect(String(initRes.body.data.footage.currentCustodianId)).toBe(String(member1._id)); // Custodian NOT changed

    // Now confirm physical receipt
    const confirmRes = await request(app)
      .post(`/api/v1/footage/${footage._id}/confirm-handover`)
      .set('Cookie', adminCookie)
      .send({ acceptedById: adminUser._id });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.footage.handoverStatus).toBe('handed_over');
    expect(String(confirmRes.body.data.footage.currentCustodianId)).toBe(String(adminUser._id));
  });
});
