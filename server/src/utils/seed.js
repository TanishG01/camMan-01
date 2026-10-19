const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Fest = require('../models/Fest');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const Equipment = require('../models/Equipment');
const EventAssignment = require('../models/EventAssignment');
const AuditLog = require('../models/AuditLog');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/festops';
    await mongoose.connect(mongoUri);
    console.log(`[Seed] Connected to MongoDB: ${mongoUri}`);

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Fest.deleteMany({}),
      Venue.deleteMany({}),
      Event.deleteMany({}),
      Equipment.deleteMany({}),
      EventAssignment.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('[Seed] Cleared existing records.');

    // 1. Create Core Users across 4 seniority tiers
    const adminUser = await User.create({
      firebaseUid: 'admin_uid',
      name: 'Aarav Sharma (Chief)',
      email: 'coordinator@festops.local',
      role: 'admin',
      seniority: '4th_year',
      skills: ['photography', 'videography', 'editing'],
      isActive: true
    });

    const senior1 = await User.create({
      firebaseUid: 'senior1_uid',
      name: 'Priya Patel (Lead Photo)',
      email: 'priya@festops.local',
      role: 'senior',
      seniority: '3rd_year',
      skills: ['photography', 'editing'],
      isActive: true
    });

    const senior2 = await User.create({
      firebaseUid: 'senior2_uid',
      name: 'Rohan Mehta (Lead Video)',
      email: 'rohan@festops.local',
      role: 'senior',
      seniority: '2nd_year',
      skills: ['videography', 'drone', 'reels'],
      isActive: true
    });

    const junior1 = await User.create({
      firebaseUid: 'junior1_uid',
      name: 'Ananya Gupta (Trainee)',
      email: 'ananya@festops.local',
      role: 'junior',
      seniority: '1st_year',
      skills: ['photography'],
      isActive: true
    });

    const junior2 = await User.create({
      firebaseUid: 'junior2_uid',
      name: 'Devansh Verma (Trainee)',
      email: 'devansh@festops.local',
      role: 'junior',
      seniority: '1st_year',
      skills: ['videography'],
      isActive: true
    });

    const devAdmin = await User.create({
      firebaseUid: 'mock_uid_admin@festops.local',
      name: 'Dev Admin',
      email: 'admin@festops.local',
      role: 'admin',
      seniority: '4th_year',
      skills: ['photography', 'videography', 'editing'],
      isActive: true
    });

    const devSenior = await User.create({
      firebaseUid: 'mock_uid_senior@festops.local',
      name: 'Dev Senior',
      email: 'senior@festops.local',
      role: 'senior',
      seniority: '3rd_year',
      skills: ['photography', 'editing'],
      isActive: true
    });

    const devJunior = await User.create({
      firebaseUid: 'mock_uid_junior@festops.local',
      name: 'Dev Junior',
      email: 'junior@festops.local',
      role: 'junior',
      seniority: '1st_year',
      skills: ['photography'],
      isActive: true
    });

    console.log('[Seed] Created users including core team and dev quick-login profiles.');

    // 2. Create Fest
    const fest = await Fest.create({
      name: 'Oasis 2026',
      description: 'Annual Cultural Festival of BITS Pilani',
      startDate: new Date('2026-10-20'),
      endDate: new Date('2026-10-24'),
      status: 'active',
      createdBy: adminUser._id
    });

    // 3. Create Venues
    const audi = await Venue.create({
      festId: fest._id,
      name: 'Main Auditorium',
      locationNotes: 'Central Campus Auditorium - AC, high stage lighting',
      travelBufferMinutes: 10,
      setupBufferMinutes: 15
    });

    const amphi = await Venue.create({
      festId: fest._id,
      name: 'SAC Amphitheatre',
      locationNotes: 'Open air stage behind Student Activity Centre',
      travelBufferMinutes: 15,
      setupBufferMinutes: 20
    });

    const rotunda = await Venue.create({
      festId: fest._id,
      name: 'Rotunda Stairs',
      locationNotes: 'Central quadrangle - informal acoustics & dance battles',
      travelBufferMinutes: 5,
      setupBufferMinutes: 10
    });

    console.log('[Seed] Created 3 venues.');

    // 4. Create Equipment Assets
    const cam1 = await Equipment.create({
      equipmentId: 'CAM-01',
      category: 'camera',
      brandModel: 'Sony Alpha 7 IV (Body A)',
      serialNumber: 'SN-S74-09821',
      condition: 'excellent',
      status: 'available',
      addedBy: adminUser._id
    });

    const cam2 = await Equipment.create({
      equipmentId: 'CAM-02',
      category: 'camera',
      brandModel: 'Canon EOS R6 Mark II',
      serialNumber: 'SN-CR6-54312',
      condition: 'good',
      status: 'available',
      addedBy: adminUser._id
    });

    const sd1 = await Equipment.create({
      equipmentId: 'SD-01',
      category: 'sd_card',
      brandModel: 'SanDisk Extreme Pro 128GB (170MB/s)',
      condition: 'excellent',
      status: 'available',
      addedBy: adminUser._id
    });

    const sd2 = await Equipment.create({
      equipmentId: 'SD-02',
      category: 'sd_card',
      brandModel: 'SanDisk Extreme Pro 128GB (170MB/s)',
      condition: 'good',
      status: 'available',
      addedBy: adminUser._id
    });

    console.log('[Seed] Created equipment inventory (Cameras & SD cards).');

    // 5. Create Events
    const event1 = await Event.create({
      festId: fest._id,
      venueId: audi._id,
      name: 'Inauguration Ceremony',
      category: 'Ceremony',
      date: new Date('2026-10-20'),
      startTime: new Date('2026-10-20T09:30:00Z'),
      endTime: new Date('2026-10-20T12:00:00Z'),
      teamSizeRequired: 2,
      priority: 'high',
      requiredDeliverables: ['photos', 'videos'],
      createdBy: adminUser._id
    });

    const event2 = await Event.create({
      festId: fest._id,
      venueId: amphi._id,
      name: 'Battle of the Bands',
      category: 'Music',
      date: new Date('2026-10-20'),
      startTime: new Date('2026-10-20T18:00:00Z'),
      endTime: new Date('2026-10-20T21:30:00Z'),
      teamSizeRequired: 3,
      priority: 'critical',
      requiredDeliverables: ['photos', 'videos', 'reels'],
      createdBy: adminUser._id
    });

    // 6. Create Assignment with Junior-Senior Pairing
    await EventAssignment.create({
      festId: fest._id,
      eventId: event1._id,
      memberId: junior1._id,
      roleInEvent: 'photographer',
      status: 'approved',
      mentorId: senior1._id,
      isMentorNeeded: false,
      approvedBy: adminUser._id,
      approvedAt: new Date()
    });

    await EventAssignment.create({
      festId: fest._id,
      eventId: event1._id,
      memberId: senior1._id,
      roleInEvent: 'lead_photographer',
      status: 'approved',
      approvedBy: adminUser._id,
      approvedAt: new Date()
    });

    console.log('[Seed] Created sample events & mentorship assignments.');
    console.log('\n[Seed Completed] FestOps database is now primed and ready!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seedData();
