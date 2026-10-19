const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  festId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fest', required: true, index: true },
  name: { type: String, required: true, trim: true },
  locationNotes: { type: String, default: '' },
  travelBufferMinutes: { type: Number, default: 10 },
  setupBufferMinutes: { type: Number, default: 15 },
}, { timestamps: true });

venueSchema.index({ festId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Venue', venueSchema);
