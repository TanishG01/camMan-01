const mongoose = require('mongoose');
const { ROLES, SENIORITY, SKILLS } = require('../config/constants');

const availabilitySlotSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },  // "HH:MM" 24-hour format
  endTime: { type: String, required: true },    // "HH:MM" 24-hour format
  isAvailable: { type: Boolean, default: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  photoURL: { type: String, default: '' },
  phone: { type: String, default: '' },
  role: { type: String, enum: ROLES, required: true, default: 'junior', index: true },
  seniority: { type: String, enum: SENIORITY, required: true, default: '1st_year' },
  skills: [{ type: String, enum: SKILLS }],
  availability: [availabilitySlotSchema],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

userSchema.index({ 'availability.festId': 1, 'availability.date': 1 });

module.exports = mongoose.model('User', userSchema);
