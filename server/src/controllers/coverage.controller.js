const CoverageRecord = require('../models/CoverageRecord');
const Event = require('../models/Event');
const User = require('../models/User');
const FootageRecord = require('../models/FootageRecord');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

/**
 * Standard Coverage Report Submission
 */
const reportCoverage = asyncHandler(async (req, res) => {
  const {
    festId, eventId, actualContributors, actualDurationMinutes,
    deliverablesProduced, camerasUsed, sdCardsUsed, coverageStatus, notes
  } = req.body;

  if (!festId) throw new ApiError(400, 'festId is required.');

  const report = await CoverageRecord.create({
    festId,
    eventId: eventId || null,
    isUnplanned: false,
    actualContributors: actualContributors || [{ memberId: req.user._id, roleInEvent: 'photographer' }],
    actualDurationMinutes: actualDurationMinutes || 0,
    deliverablesProduced: deliverablesProduced || ['photos'],
    camerasUsed: camerasUsed || [],
    sdCardsUsed: sdCardsUsed || [],
    coverageStatus: coverageStatus || 'covered',
    notes: notes || '',
    validationStatus: 'pending_review',
    reportedBy: req.user._id
  });

  // Automatically initialize FootageRecords for any SD cards used
  if (sdCardsUsed && Array.isArray(sdCardsUsed)) {
    for (const sdCardId of sdCardsUsed) {
      await FootageRecord.create({
        festId,
        coverageRecordId: report._id,
        sdCardId,
        cameraUsedId: camerasUsed?.[0] || null,
        currentCustodianId: req.user._id,
        handoverStatus: 'not_yet_handed_over',
        backupStatus: 'backup_pending',
        verificationStatus: 'unverified'
      });
    }
  }

  // Notify leads
  const seniors = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
  await notificationService.notifyMany(seniors.map(s => s._id), {
    type: 'coverage_validated',
    title: 'Coverage Report Submitted',
    message: `${req.user.name} submitted a coverage report requiring review.`,
    relatedEntity: { entityType: 'CoverageRecord', entityId: report._id }
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'COVERAGE_SUBMITTED',
    targetEntity: { entityType: 'CoverageRecord', entityId: report._id },
    req
  });

  return success(res, { report }, 'Coverage report submitted for lead validation', 201);
});

/**
 * Case 7: Unplanned / Extra Event Coverage Report
 * Multi-member attribution preserved. Reporter is not auto-credited solely.
 */
const reportUnplanned = asyncHandler(async (req, res) => {
  const {
    festId, eventId, unplannedDetails, actualContributors,
    actualDurationMinutes, deliverablesProduced, camerasUsed, sdCardsUsed, notes
  } = req.body;

  if (!festId) throw new ApiError(400, 'festId is required.');
  if (!eventId && (!unplannedDetails || !unplannedDetails.eventName)) {
    throw new ApiError(400, 'Either an eventId or unplannedDetails.eventName is required.');
  }

  // Multi-contributor validation: actualContributors must be explicitly defined
  const contributors = Array.isArray(actualContributors) && actualContributors.length > 0
    ? actualContributors
    : [{ memberId: req.user._id, roleInEvent: 'photographer' }];

  const report = await CoverageRecord.create({
    festId,
    eventId: eventId || null,
    isUnplanned: true,
    unplannedDetails: unplannedDetails || {},
    actualContributors: contributors,
    actualDurationMinutes: actualDurationMinutes || 0,
    deliverablesProduced: deliverablesProduced || ['photos'],
    camerasUsed: camerasUsed || [],
    sdCardsUsed: sdCardsUsed || [],
    coverageStatus: 'covered',
    notes: notes || '',
    validationStatus: 'pending_review',
    reportedBy: req.user._id // Authenticated user logged as reporter
  });

  // Create FootageRecords for SD cards
  if (sdCardsUsed && Array.isArray(sdCardsUsed)) {
    for (const sdCardId of sdCardsUsed) {
      await FootageRecord.create({
        festId,
        coverageRecordId: report._id,
        sdCardId,
        cameraUsedId: camerasUsed?.[0] || null,
        currentCustodianId: req.user._id,
        handoverStatus: 'not_yet_handed_over',
        backupStatus: 'backup_pending',
        verificationStatus: 'unverified'
      });
    }
  }

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'UNPLANNED_COVERAGE_SUBMITTED',
    targetEntity: { entityType: 'CoverageRecord', entityId: report._id },
    reason: `Unplanned event coverage for "${unplannedDetails?.eventName || 'Extra Event'}"`,
    req
  });

  return success(res, { report }, 'Unplanned coverage report submitted successfully for review', 201);
});

const getCoverage = asyncHandler(async (req, res) => {
  const { festId, eventId, memberId, validationStatus } = req.query;
  const filter = {};

  if (festId) filter.festId = festId;
  if (eventId) filter.eventId = eventId;
  if (validationStatus) filter.validationStatus = validationStatus;
  if (memberId) {
    filter['actualContributors.memberId'] = memberId;
  }

  const records = await CoverageRecord.find(filter)
    .populate('eventId', 'name category date startTime endTime venueId')
    .populate('actualContributors.memberId', 'name email role seniority')
    .populate('reportedBy', 'name email')
    .populate('validatedBy', 'name email')
    .populate('camerasUsed', 'equipmentId brandModel')
    .populate('sdCardsUsed', 'equipmentId brandModel')
    .sort({ createdAt: -1 });

  return success(res, { coverage: records, count: records.length }, 'Coverage records retrieved');
});

const validateCoverage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { validationStatus, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(validationStatus)) {
    throw new ApiError(400, 'validationStatus must be "approved" or "rejected".');
  }

  const record = await CoverageRecord.findById(id).populate('actualContributors.memberId');
  if (!record) throw new ApiError(404, 'Coverage record not found.');

  record.validationStatus = validationStatus;
  record.validatedBy = req.user._id;
  record.validatedAt = new Date();
  if (rejectionReason) record.rejectionReason = rejectionReason;
  await record.save();

  // Notify contributors of credit validation
  if (validationStatus === 'approved') {
    for (const c of record.actualContributors) {
      await notificationService.createNotification({
        recipientId: c.memberId._id,
        type: 'coverage_validated',
        title: 'Coverage Approved & Credited',
        message: `Your coverage contribution has been validated and added to your completed work history.`,
        relatedEntity: { entityType: 'CoverageRecord', entityId: record._id }
      });
    }
  }

  await auditService.log({
    festId: record.festId,
    actorId: req.user._id,
    action: 'COVERAGE_VALIDATED',
    targetEntity: { entityType: 'CoverageRecord', entityId: record._id },
    changes: { validationStatus },
    reason: rejectionReason,
    req
  });

  return success(res, { coverage: record }, `Coverage report ${validationStatus}`);
});

module.exports = {
  reportCoverage,
  reportUnplanned,
  getCoverage,
  validateCoverage
};
