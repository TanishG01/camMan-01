const mongoose = require('mongoose');
const { FEST_STATUS } = require('../config/constants');

const festSettingsSchema = new mongoose.Schema({
  autoReminderMinutesBeforeEvent: { type: Number, default: 30 },
  equipmentOverdueCheckIntervalMinutes: { type: Number, default: 60 },
  allowSequentialCameraBufferMinutes: { type: Number, default: 15 },
  requireMentorForJuniors: { type: Boolean, default: true }
}, { _id: false });

const festSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: FEST_STATUS, default: 'upcoming', index: true },
  settings: { type: festSettingsSchema, default: () => ({}) },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Fest', festSchema);
