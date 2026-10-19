const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

const getMyNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  const filter = { recipientId: req.user._id };

  if (unreadOnly === 'true') {
    filter.isRead = false;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(50);

  const unreadCount = await Notification.countDocuments({
    recipientId: req.user._id,
    isRead: false
  });

  return success(res, { notifications, unreadCount }, 'Notifications retrieved');
});

const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notif = await Notification.findOneAndUpdate(
    { _id: id, recipientId: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );

  if (!notif) throw new ApiError(404, 'Notification not found.');
  return success(res, { notification: notif }, 'Notification marked as read');
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipientId: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );
  return success(res, null, 'All notifications marked as read');
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead
};
