const mongoose = require('mongoose');
const { EVENT_STATUS, EVENT_PRIORITY, DELIVERABLES, SKILLS } = require('../config/constants');

const changeHistoryEntrySchema = new mongoose.Schema({
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now },
  fieldChanged: { type: String, required: true },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, default: '' }
}, { _id: false });

const equipmentRequirementSchema = new mongoose.Schema({
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  notes: { type: String, default: '' }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  date: { type: Date, required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  minCoverageDurationMinutes: { type: Number, default: 15 },
  requiredDeliverables: [{ type: String, enum: DELIVERABLES }],
  teamSizeRequired: { type: Number, default: 2, min: 1 },
  requiredSkills: [{ type: String, enum: SKILLS }],
  priority: { type: String, enum: EVENT_PRIORITY, default: 'medium' },
  specialInstructions: { type: String, default: '' },
  status: { type: String, enum: EVENT_STATUS, default: 'scheduled', index: true },
  equipmentRequirements: [equipmentRequirementSchema],
  delayInfo: {
    isDelayed: { type: Boolean, default: false },
    originalEndTime: { type: Date },
    newEndTime: { type: Date },
    reason: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedAt: { type: Date }
  },
  cancellationInfo: {
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' }
  },
  changeHistory: [changeHistoryEntrySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  importedFrom: { type: String, default: null },
}, { timestamps: true });

eventSchema.index({ festId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('Event', eventSchema);
