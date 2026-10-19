const mongoose = require('mongoose');
const { COVERAGE_STATUS, COVERAGE_VALIDATION, DELIVERABLES } = require('../config/constants');

const actualContributorSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roleInEvent: { type: String, default: '' },
  contributionNotes: { type: String, default: '' }
}, { _id: false });

const coverageRecordSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null, index: true },
  isUnplanned: { type: Boolean, default: false },
  unplannedDetails: {
    eventName: { type: String, default: '' },
    venueName: { type: String, default: '' },
    eventDate: { type: Date }
  },
  plannedMemberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  actualContributors: [actualContributorSchema],
  actualDurationMinutes: { type: Number, default: 0 },
  deliverablesProduced: [{ type: String, enum: DELIVERABLES }],
  camerasUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' }],
  sdCardsUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' }],
  coverageStatus: { type: String, enum: COVERAGE_STATUS, default: 'not_started', index: true },
  notes: { type: String, default: '' },
  validationStatus: { type: String, enum: COVERAGE_VALIDATION, default: 'pending_review' },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  validatedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('CoverageRecord', coverageRecordSchema);
