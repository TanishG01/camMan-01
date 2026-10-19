const mongoose = require('mongoose');
const { HANDOVER_STATUS, BACKUP_STATUS, VERIFICATION_STATUS } = require('../config/constants');

const footageIssueSchema = new mongoose.Schema({
  issueType: {
    type: String,
    enum: ['corruption', 'missing_files', 'physical_damage', 'backup_failure', 'other'],
    required: true
  },
  description: { type: String, required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedAt: { type: Date, default: Date.now },
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNotes: { type: String, default: '' }
}, { _id: false });

const footageRecordSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  coverageRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoverageRecord', required: true, index: true },
  sdCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true, index: true },
  cameraUsedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },
  currentCustodianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  handoverStatus: { type: String, enum: HANDOVER_STATUS, default: 'not_yet_handed_over', index: true },
  handoverNotes: { type: String, default: '' },
  handedOverToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  handedOverAt: { type: Date, default: null },
  handoverAcceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  backupStatus: { type: String, enum: BACKUP_STATUS, default: 'backup_pending', index: true },
  backupLocation: { type: String, default: '' },
  backupExecutedAt: { type: Date, default: null },
  backupExecutedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verificationStatus: { type: String, enum: VERIFICATION_STATUS, default: 'unverified', index: true },
  verifiedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  issues: [footageIssueSchema],
}, { timestamps: true });

module.exports = mongoose.model('FootageRecord', footageRecordSchema);
