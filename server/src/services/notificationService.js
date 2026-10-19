const Notification = require('../models/Notification');

/**
 * Creates in-app notifications with hourly window deduplication
 */
const createNotification = async ({ recipientId, type, title, message, relatedEntity = null }) => {
  const now = new Date();
  const hourKey = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}`;
  const entityIdStr = relatedEntity?.entityId ? String(relatedEntity.entityId) : 'none';
  const dedupKey = `${type}_${entityIdStr}_${recipientId}_${hourKey}`;

  try {
    const notif = await Notification.create({
      recipientId,
      type,
      title,
      message,
      relatedEntity,
      dedupKey
    });
    return notif;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate notification within the same hourly window - silently ignore
      return null;
    }
    console.error('[NotificationService] Error creating notification:', err.message);
    return null;
  }
};

/**
 * Broadcasts a notification to all users matching a role or list of user IDs
 */
const notifyMany = async (recipientIds, { type, title, message, relatedEntity }) => {
  const promises = recipientIds.map(recipientId =>
    createNotification({ recipientId, type, title, message, relatedEntity })
  );
  return Promise.all(promises);
};

module.exports = {
  createNotification,
  notifyMany
};
