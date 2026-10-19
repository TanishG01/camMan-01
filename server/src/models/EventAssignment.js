const mongoose = require('mongoose');
const { ASSIGNMENT_STATUS, ASSIGNMENT_ROLE_IN_EVENT } = require('../config/constants');

const reassignmentHistoryEntrySchema = new mongoose.Schema({
  originalMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  replacedByMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const eventAssignmentSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roleInEvent: { type: String, enum: ASSIGNMENT_ROLE_IN_EVENT, required: true },
  status: { type: String, enum: ASSIGNMENT_STATUS, default: 'suggested', index: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isMentorNeeded: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  isManualOverride: { type: Boolean, default: false },
  overrideReason: { type: String, default: '' },
  reassignmentHistory: [reassignmentHistoryEntrySchema],
  actuallyContributed: { type: Boolean, default: null },
}, { timestamps: true });

eventAssignmentSchema.index({ eventId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model('EventAssignment', eventAssignmentSchema);
