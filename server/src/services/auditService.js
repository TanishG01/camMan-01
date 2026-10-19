const AuditLog = require('../models/AuditLog');

const log = async ({ festId = null, actorId, action, targetEntity, changes = {}, reason = '', req = null }) => {
  try {
    const entry = await AuditLog.create({
      festId,
      actorId,
      action,
      targetEntity,
      changes,
      reason,
      ipAddress: req?.ip || req?.socket?.remoteAddress || '',
      timestamp: new Date()
    });
    return entry;
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err.message);
    return null;
  }
};

module.exports = {
  log
};
