const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { exportAuditLogsToCsv } = require('../utils/csvExporter');

const getAuditLogs = asyncHandler(async (req, res) => {
  const { festId, actorId, action, entityType, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (festId) filter.festId = festId;
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = action;
  if (entityType) filter['targetEntity.entityType'] = entityType;

  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actorId', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(l),
    AuditLog.countDocuments(filter)
  ]);

  return success(res, {
    logs,
    pagination: {
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    }
  }, 'Audit logs retrieved');
});

const exportAuditLogs = asyncHandler(async (req, res) => {
  const { festId, from, to } = req.query;
  const filter = {};

  if (festId) filter.festId = festId;
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const logs = await AuditLog.find(filter)
    .populate('actorId', 'name email')
    .sort({ timestamp: -1 })
    .limit(5000);

  const csvData = exportAuditLogsToCsv(logs);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="festops_audit_${Date.now()}.csv"`);
  return res.status(200).send(csvData);
});

module.exports = {
  getAuditLogs,
  exportAuditLogs
};
