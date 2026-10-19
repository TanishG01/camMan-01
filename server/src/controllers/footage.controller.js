const FootageRecord = require('../models/FootageRecord');
const Equipment = require('../models/Equipment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

const listFootage = asyncHandler(async (req, res) => {
  const { festId, handoverStatus, backupStatus, verificationStatus } = req.query;
  const filter = {};

  if (festId) filter.festId = festId;
  if (handoverStatus) filter.handoverStatus = handoverStatus;
  if (backupStatus) filter.backupStatus = backupStatus;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  const records = await FootageRecord.find(filter)
    .populate('coverageRecordId')
    .populate('sdCardId', 'equipmentId brandModel condition status')
    .populate('cameraUsedId', 'equipmentId brandModel')
    .populate('currentCustodianId', 'name email phone role')
    .populate('handedOverToId', 'name email')
    .populate('verifiedById', 'name email')
    .sort({ createdAt: -1 });

  return success(res, { footage: records, count: records.length }, 'Footage pipeline records retrieved');
});

/**
 * Initiate Handover
 * Rule: Written notes do NOT mark status as handed_over. Only sets handover_pending.
 */
const initiateHandover = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { handedOverToId, handoverNotes } = req.body;

  const footage = await FootageRecord.findById(id).populate('sdCardId');
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  footage.handoverStatus = 'handover_pending';
  if (handoverNotes) footage.handoverNotes = handoverNotes;
  if (handedOverToId) footage.handedOverToId = handedOverToId;
  await footage.save();

  return success(res, { footage }, 'SD card handover initiated. Physical receipt must still be confirmed by recipient.');
});

/**
 * Confirm Handover
 * ONLY this endpoint marks handoverStatus = 'handed_over' and updates currentCustodianId.
 */
const confirmHandover = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acceptedById } = req.body;

  const footage = await FootageRecord.findById(id).populate('sdCardId');
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  const acceptorId = acceptedById || req.user._id;
  footage.handoverStatus = 'handed_over';
  footage.currentCustodianId = acceptorId;
  footage.handedOverAt = new Date();
  footage.handoverAcceptedBy = acceptorId;
  await footage.save();

  // Also update the SD Card Equipment's currentCustodianId
  await Equipment.findByIdAndUpdate(footage.sdCardId._id, {
    currentCustodianId: acceptorId
  });

  await auditService.log({
    festId: footage.festId,
    actorId: req.user._id,
    action: 'SD_HANDOVER_CONFIRMED',
    targetEntity: { entityType: 'FootageRecord', entityId: footage._id },
    changes: { handoverStatus: 'handed_over', newCustodian: acceptorId },
    req
  });

  return success(res, { footage }, 'SD Card physical handover explicitly confirmed');
});

const updateBackup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { backupStatus, backupLocation } = req.body;

  const footage = await FootageRecord.findById(id);
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  if (backupStatus) footage.backupStatus = backupStatus;
  if (backupLocation) footage.backupLocation = backupLocation;
  if (backupStatus === 'backed_up') {
    footage.backupExecutedAt = new Date();
    footage.backupExecutedBy = req.user._id;
  }
  await footage.save();

  await auditService.log({
    festId: footage.festId,
    actorId: req.user._id,
    action: 'BACKUP_UPDATED',
    targetEntity: { entityType: 'FootageRecord', entityId: footage._id },
    changes: { backupStatus, backupLocation },
    req
  });

  return success(res, { footage }, 'Backup status updated');
});

/**
 * Case 6: Flag SD Card Corruption / Backup Issue
 */
const flagIssue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { issueType, description } = req.body;

  if (!issueType || !description) {
    throw new ApiError(400, 'issueType and description are required.');
  }

  const footage = await FootageRecord.findById(id);
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  footage.issues.push({
    issueType,
    description,
    reportedBy: req.user._id,
    reportedAt: new Date(),
    isResolved: false
  });

  footage.verificationStatus = 'issue_recheck_required';
  await footage.save();

  // Notify team leads & admins
  const seniors = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
  await notificationService.notifyMany(seniors.map(s => s._id), {
    type: 'footage_issue',
    title: `Footage Issue Flagged: ${issueType.toUpperCase()}`,
    message: `${req.user.name} reported: "${description}". Verification locked until resolved.`,
    relatedEntity: { entityType: 'FootageRecord', entityId: footage._id }
  });

  await auditService.log({
    festId: footage.festId,
    actorId: req.user._id,
    action: 'FOOTAGE_ISSUE_FLAGGED',
    targetEntity: { entityType: 'FootageRecord', entityId: footage._id },
    reason: description,
    req
  });

  return success(res, { footage }, 'Footage issue logged. Verification blocked until resolved.');
});

/**
 * Resolve Issue
 */
const resolveIssue = asyncHandler(async (req, res) => {
  const { id, issueIndex } = req.params;
  const { resolutionNotes } = req.body;

  const footage = await FootageRecord.findById(id);
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  const idx = parseInt(issueIndex, 10);
  if (isNaN(idx) || !footage.issues[idx]) {
    throw new ApiError(404, 'Issue index not found.');
  }

  footage.issues[idx].isResolved = true;
  footage.issues[idx].resolvedAt = new Date();
  footage.issues[idx].resolvedBy = req.user._id;
  footage.issues[idx].resolutionNotes = resolutionNotes || 'Resolved';
  await footage.save();

  return success(res, { footage }, 'Issue marked as resolved');
});

/**
 * Case 6: Verify Footage
 * BLOCKED if any issue is unresolved!
 */
const verifyFootage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const footage = await FootageRecord.findById(id);
  if (!footage) throw new ApiError(404, 'Footage record not found.');

  // Check open issues
  const hasOpenIssues = footage.issues.some(i => !i.isResolved);
  if (hasOpenIssues) {
    throw new ApiError(400, 'Cannot verify footage! Open corruption/backup issues must be resolved first.');
  }

  footage.verificationStatus = 'verified';
  footage.verifiedById = req.user._id;
  footage.verifiedAt = new Date();
  await footage.save();

  await auditService.log({
    festId: footage.festId,
    actorId: req.user._id,
    action: 'FOOTAGE_VERIFIED',
    targetEntity: { entityType: 'FootageRecord', entityId: footage._id },
    req
  });

  return success(res, { footage }, 'Footage verified successfully');
});

module.exports = {
  listFootage,
  initiateHandover,
  confirmHandover,
  updateBackup,
  flagIssue,
  resolveIssue,
  verifyFootage
};
