const mongoose = require('mongoose');
const { EQUIPMENT_CATEGORY, EQUIPMENT_CONDITION, EQUIPMENT_STATUS } = require('../config/constants');

const equipmentSchema = new mongoose.Schema({
  equipmentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  category: { type: String, enum: EQUIPMENT_CATEGORY, required: true, index: true },
  brandModel: { type: String, required: true, trim: true },
  serialNumber: { type: String, default: '', trim: true },
  condition: { type: String, enum: EQUIPMENT_CONDITION, default: 'good' },
  status: { type: String, enum: EQUIPMENT_STATUS, default: 'available', index: true },
  currentCustodianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  preUseChecklistTemplate: [{ type: String }],
  maintenanceNotes: { type: String, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);
