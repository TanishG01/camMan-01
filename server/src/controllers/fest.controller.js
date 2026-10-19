const Fest = require('../models/Fest');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const EventAssignment = require('../models/EventAssignment');
const CoverageRecord = require('../models/CoverageRecord');
const FootageRecord = require('../models/FootageRecord');
const Equipment = require('../models/Equipment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');

const createFest = asyncHandler(async (req, res) => {
  const { name, description, startDate, endDate, settings } = req.body;
  if (!name || !startDate || !endDate) {
    throw new ApiError(400, 'Fest name, startDate, and endDate are required.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid startDate or endDate.');
  }
  if (start > end) {
    throw new ApiError(400, 'startDate cannot be after endDate.');
  }

  const fest = await Fest.create({
    name,
    description: description || '',
    startDate: start,
    endDate: end,
    settings: settings || {},
    createdBy: req.user._id
  });

  await auditService.log({
    festId: fest._id,
    actorId: req.user._id,
    action: 'FEST_CREATED',
    targetEntity: { entityType: 'Fest', entityId: fest._id },
    changes: { after: fest.toObject() },
    req
  });

  return success(res, { fest }, 'Fest created successfully', 201);
});

const getFests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const fests = await Fest.find(filter).sort({ startDate: -1 });

  // Attach venue & event counts
  const festIds = fests.map(f => f._id);
  const [venueCounts, eventCounts] = await Promise.all([
    Venue.aggregate([
      { $match: { festId: { $in: festIds } } },
      { $group: { _id: '$festId', count: { $sum: 1 } } }
    ]),
    Event.aggregate([
      { $match: { festId: { $in: festIds } } },
      { $group: { _id: '$festId', count: { $sum: 1 } } }
    ])
  ]);

  const venueMap = new Map(venueCounts.map(v => [String(v._id), v.count]));
  const eventMap = new Map(eventCounts.map(e => [String(e._id), e.count]));

  const enriched = fests.map(f => ({
    ...f.toObject(),
    venueCount: venueMap.get(String(f._id)) || 0,
    eventCount: eventMap.get(String(f._id)) || 0
  }));

  return success(res, { fests: enriched, count: enriched.length }, 'Fests retrieved');
});

const getFestById = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const fest = await Fest.findById(festId).populate('createdBy', 'name email');
  if (!fest) {
    throw new ApiError(404, 'Fest not found.');
  }

  const [venueCount, eventCount] = await Promise.all([
    Venue.countDocuments({ festId }),
    Event.countDocuments({ festId })
  ]);

  return success(res, {
    fest: {
      ...fest.toObject(),
      venueCount,
      eventCount
    }
  }, 'Fest details retrieved');
});

const updateFest = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const fest = await Fest.findById(festId);
  if (!fest) {
    throw new ApiError(404, 'Fest not found.');
  }

  const before = fest.toObject();
  const updatable = ['name', 'description', 'startDate', 'endDate', 'settings'];
  updatable.forEach(key => {
    if (req.body[key] !== undefined) {
      fest[key] = req.body[key];
    }
  });

  await fest.save();

  await auditService.log({
    festId: fest._id,
    actorId: req.user._id,
    action: 'FEST_UPDATED',
    targetEntity: { entityType: 'Fest', entityId: fest._id },
    changes: { before, after: fest.toObject() },
    req
  });

  return success(res, { fest }, 'Fest updated successfully');
});

const updateFestStatus = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const { status } = req.body;
  const { FEST_STATUS } = require('../config/constants');

  if (!FEST_STATUS.includes(status)) {
    throw new ApiError(400, `Invalid status. Allowed: ${FEST_STATUS.join(', ')}`);
  }

  const fest = await Fest.findById(festId);
  if (!fest) throw new ApiError(404, 'Fest not found.');

  const before = fest.status;
  fest.status = status;
  await fest.save();

  await auditService.log({
    festId: fest._id,
    actorId: req.user._id,
    action: 'FEST_UPDATED',
    targetEntity: { entityType: 'Fest', entityId: fest._id },
    changes: { before: { status: before }, after: { status } },
    reason: `Fest lifecycle status changed to ${status}`,
    req
  });

  return success(res, { fest }, `Fest status updated to ${status}`);
});

const deleteFest = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const fest = await Fest.findById(festId);
  if (!fest) {
    throw new ApiError(404, 'Fest not found.');
  }

  // Free equipment reserved or allocated for this fest
  const reservedOrAllocatedAssignments = await EquipmentAssignment.find({
    festId,
    status: { $in: ['reserved', 'allocated'] }
  });
  const eqIdsToFree = reservedOrAllocatedAssignments.map(a => a.equipmentId);
  if (eqIdsToFree.length > 0) {
    await Equipment.updateMany(
      { _id: { $in: eqIdsToFree }, status: { $in: ['reserved', 'allocated'] } },
      { $set: { status: 'available', currentCustodianId: null } }
    );
  }

  // Cascading deletes of all child records
  await Promise.all([
    EventAssignment.deleteMany({ festId }),
    CoverageRecord.deleteMany({ festId }),
    FootageRecord.deleteMany({ festId }),
    EquipmentAssignment.deleteMany({ festId }),
    Event.deleteMany({ festId }),
    Venue.deleteMany({ festId }),
    Fest.findByIdAndDelete(festId)
  ]);

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'FEST_DELETED',
    targetEntity: { entityType: 'Fest', entityId: fest._id },
    changes: { before: fest.toObject() },
    reason: `Fest "${fest.name}" and all associated data deleted by ${req.user.role}`,
    req
  });

  return success(res, { deletedFestId: festId }, `Fest "${fest.name}" and associated records deleted successfully`);
});

module.exports = {
  createFest,
  getFests,
  getFestById,
  updateFest,
  updateFestStatus,
  deleteFest
};
