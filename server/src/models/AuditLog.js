const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../config/constants');

const auditLogSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', default: null, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
  targetEntity: {
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId }
  },
  changes: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed }
  },
  reason: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

module.exports = mongoose.model('AuditLog', auditLogSchema);
