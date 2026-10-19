const mongoose = require('mongoose');
const { EQUIPMENT_ASSIGNMENT_STATUS } = require('../config/constants');

const equipmentAssignmentSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  assignedHolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  issuedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  returnReceivedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: EQUIPMENT_ASSIGNMENT_STATUS, default: 'reserved', index: true },
  reservedAt: { type: Date, default: Date.now },
  allocatedAt: { type: Date, default: null },
  checkoutTime: { type: Date, default: null },
  expectedReturnTime: { type: Date, required: true },
  actualReturnTime: { type: Date, default: null },
  conditionAtCheckout: { type: String, default: '' },
  conditionAtReturn: { type: String, default: '' },
  preUseChecklistSnapshot: [{
    checkItem: { type: String },
    isPassed: { type: Boolean }
  }],
  checkoutNotes: { type: String, default: '' },
  returnNotes: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

equipmentAssignmentSchema.index({ equipmentId: 1, status: 1 });

module.exports = mongoose.model('EquipmentAssignment', equipmentAssignmentSchema);
