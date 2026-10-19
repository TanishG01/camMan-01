const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedEntity: {
    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId }
  },
  isRead: { type: Boolean, default: false, index: true },
  dedupKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
