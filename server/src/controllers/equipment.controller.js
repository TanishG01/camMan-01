const Equipment = require('../models/Equipment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const User = require('../models/User');
const Fest = require('../models/Fest');
const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');
const equipmentService = require('../services/equipmentService');
const notificationService = require('../services/notificationService');

const listEquipment = asyncHandler(async (req, res) => {
  const { category, status, condition, search } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (condition) filter.condition = condition;
  if (search) {
    filter.$or = [
      { equipmentId: { $regex: search, $options: 'i' } },
      { brandModel: { $regex: search, $options: 'i' } }
    ];
  }

  const items = await Equipment.find(filter)
    .populate('currentCustodianId', 'name email role seniority phone')
    .populate('addedBy', 'name email role seniority')
    .sort({ equipmentId: 1 });

  // Attach active assignment details (who holds it, which event, who issued/manages it)
  const equipmentIds = items.map(i => i._id);
  const activeAssignments = await EquipmentAssignment.find({
    equipmentId: { $in: equipmentIds },
    status: { $in: ['reserved', 'allocated', 'checked_out', 'return_pending'] }
  })
    .populate('assignedHolderId', 'name email role seniority phone')
    .populate('issuedById', 'name email role seniority')
    .populate('eventId', 'name category date startTime endTime')
    .populate('festId', 'name');

  const assignmentMap = new Map(activeAssignments.map(a => [String(a.equipmentId), a]));

  const enrichedItems = items.map(item => {
    const itemObj = item.toObject();
    itemObj.activeAssignment = assignmentMap.get(String(item._id)) || null;
    return itemObj;
  });

  return success(res, { equipment: enrichedItems, count: enrichedItems.length }, 'Equipment inventory retrieved');
});

const getEquipmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await Equipment.findById(id).populate('currentCustodianId', 'name email role phone');
  if (!item) throw new ApiError(404, 'Equipment not found.');

  const activeAssignment = await EquipmentAssignment.findOne({
    equipmentId: item._id,
    status: { $in: ['reserved', 'allocated', 'checked_out', 'return_pending'] }
  }).populate('assignedHolderId', 'name email phone').populate('eventId', 'name date startTime endTime');

  return success(res, { equipment: item, activeAssignment }, 'Equipment retrieved');
});

const createEquipment = asyncHandler(async (req, res) => {
  const { equipmentId, category, brandModel, serialNumber, condition, preUseChecklistTemplate } = req.body;
  if (!equipmentId || !category || !brandModel) {
    throw new ApiError(400, 'equipmentId, category, and brandModel are required.');
  }

  const normalizedId = equipmentId.trim().toUpperCase();
  const existing = await Equipment.findOne({ equipmentId: normalizedId });
  if (existing) {
    throw new ApiError(409, `Equipment with ID "${normalizedId}" already exists.`);
  }

  const item = await Equipment.create({
    equipmentId: normalizedId,
    category,
    brandModel: brandModel.trim(),
    serialNumber: serialNumber || '',
    condition: condition || 'good',
    status: 'available',
    preUseChecklistTemplate: preUseChecklistTemplate || [
      'Battery charged above 80%',
      'Lens element clean and scratch-free',
      'Memory card formatted & tested',
      'Neck strap / mount secured'
    ],
    addedBy: req.user._id
  });

  await auditService.log({
    actorId: req.user._id,
    action: 'EQUIPMENT_ADDED',
    targetEntity: { entityType: 'Equipment', entityId: item._id },
    changes: { after: item.toObject() },
    req
  });

  return success(res, { equipment: item }, 'Equipment added to inventory', 201);
});

const updateCondition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { condition, maintenanceNotes } = req.body;

  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  const before = { condition: item.condition, maintenanceNotes: item.maintenanceNotes };
  if (condition) item.condition = condition;
  if (maintenanceNotes !== undefined) item.maintenanceNotes = maintenanceNotes;
  await item.save();

  await auditService.log({
    actorId: req.user._id,
    action: 'EQUIPMENT_DAMAGED',
    targetEntity: { entityType: 'Equipment', entityId: item._id },
    changes: { before, after: { condition: item.condition, maintenanceNotes } },
    req
  });

  return success(res, { equipment: item }, 'Equipment condition updated');
});

const reserveEquipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { festId, eventId, holderId, expectedReturnTime } = req.body;

  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');
  if (item.status !== 'available') {
    throw new ApiError(400, `Cannot reserve equipment in "${item.status}" status.`);
  }

  item.status = 'reserved';
  item.currentCustodianId = holderId;
  await item.save();

  const assignment = await EquipmentAssignment.create({
    festId,
    equipmentId: item._id,
    eventId: eventId || null,
    assignedHolderId: holderId,
    status: 'reserved',
    expectedReturnTime: expectedReturnTime ? new Date(expectedReturnTime) : new Date(Date.now() + 6 * 3600000)
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EQUIPMENT_RESERVED',
    targetEntity: { entityType: 'Equipment', entityId: item._id },
    changes: { status: 'reserved', holderId },
    req
  });

  return success(res, { equipment: item, assignment }, 'Equipment reserved');
});

/**
 * Case 8: Atomic Concurrency Allocation
 */
const allocateEquipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { festId, eventId, holderId, expectedReturnTime } = req.body;

  if (!festId || !holderId) {
    throw new ApiError(400, 'festId and holderId are required.');
  }

  const result = await equipmentService.allocateEquipmentAtomically(
    id,
    holderId,
    eventId,
    festId,
    expectedReturnTime,
    req.user,
    req
  );

  return success(res, result, 'Equipment allocated successfully');
});

const checkoutEquipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await equipmentService.checkoutEquipment(id, req.body, req.user, req);
  return success(res, result, 'Equipment checked out successfully');
});

/**
 * Case 5: Independent Return
 */
const returnEquipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  // Juniors can only return equipment where they are the current custodian
  if (req.user.role === 'junior' && String(item.currentCustodianId) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only return equipment that was checked out to you.');
  }

  const result = await equipmentService.returnEquipment(id, req.body, req.user, req);
  return success(res, result, 'Equipment returned successfully');
});

const reportLost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  item.status = 'lost';
  item.condition = 'lost';
  item.maintenanceNotes = reason || 'Reported lost';
  await item.save();

  await auditService.log({
    actorId: req.user._id,
    action: 'EQUIPMENT_LOST',
    targetEntity: { entityType: 'Equipment', entityId: item._id },
    changes: { status: 'lost' },
    reason: reason || 'Reported lost',
    req
  });

  return success(res, { equipment: item }, 'Equipment status marked as lost');
});

const sendToMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  item.status = 'maintenance';
  item.maintenanceNotes = reason || 'Sent for service/repair';
  await item.save();

  return success(res, { equipment: item }, 'Equipment moved to maintenance');
});

const restoreFromMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await Equipment.findById(id);
  if (!item) throw new ApiError(404, 'Equipment not found.');

  item.status = 'available';
  item.condition = 'good';
  await item.save();

  return success(res, { equipment: item }, 'Equipment certified and restored to available');
});

const checkSequentialFeasibility = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { event1Id, event2Id } = req.query;

  if (!event1Id || !event2Id) {
    throw new ApiError(400, 'event1Id and event2Id query parameters are required.');
  }

  const result = await equipmentService.checkSequentialFeasibility(id, event1Id, event2Id);
  return success(res, result, 'Sequential feasibility evaluated');
});

/**
 * Direct Equipment Take / Check Out
 * Allows a crew member to take an available camera (for themselves or assigned by coordinator)
 */
const takeEquipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    holderId,
    festId,
    eventId,
    expectedReturnTime,
    preUseChecklistSnapshot,
    checkoutNotes,
    conditionAtCheckout
  } = req.body;

  const equipment = await Equipment.findById(id).populate('currentCustodianId', 'name email role phone');
  if (!equipment) throw new ApiError(404, 'Equipment not found.');

  if (equipment.status === 'checked_out') {
    throw new ApiError(409, `Equipment "${equipment.equipmentId}" is already checked out by ${equipment.currentCustodianId?.name || 'another member'}.`);
  }
  if (['maintenance', 'lost'].includes(equipment.status)) {
    throw new ApiError(400, `Cannot check out equipment in "${equipment.status}" status.`);
  }

  // Determine target holder
  let targetHolderId = req.user._id;
  if (holderId && String(holderId) !== String(req.user._id)) {
    // Non-coordinators can only check out for themselves
    if (!['admin', 'senior'].includes(req.user.role)) {
      throw new ApiError(403, 'Only coordinators and admins can check out equipment on behalf of other members.');
    }
    const targetUser = await User.findById(holderId);
    if (!targetUser) throw new ApiError(404, 'Assigned holder member not found.');
    targetHolderId = targetUser._id;
  }

  // Determine Fest ID
  let resolvedFestId = festId;
  if (!resolvedFestId && eventId) {
    const event = await Event.findById(eventId);
    if (event) resolvedFestId = event.festId;
  }
  if (!resolvedFestId) {
    const activeFest = await Fest.findOne({ status: { $in: ['active', 'upcoming'] } }).sort({ startDate: 1 });
    resolvedFestId = activeFest?._id || (await Fest.findOne())?._id;
  }
  if (!resolvedFestId) {
    const defaultFest = await Fest.findOne();
    resolvedFestId = defaultFest?._id;
  }

  // Update Equipment
  equipment.status = 'checked_out';
  equipment.currentCustodianId = targetHolderId;
  if (conditionAtCheckout) equipment.condition = conditionAtCheckout;
  await equipment.save();

  // Create or Update Assignment Record
  let assignment = await EquipmentAssignment.findOne({
    equipmentId: equipment._id,
    status: { $in: ['reserved', 'allocated'] }
  }).sort({ createdAt: -1 });

  const defaultReturnTime = expectedReturnTime
    ? new Date(expectedReturnTime)
    : new Date(Date.now() + 6 * 3600000); // 6 hours default

  if (assignment) {
    assignment.status = 'checked_out';
    assignment.assignedHolderId = targetHolderId;
    assignment.issuedById = req.user._id;
    assignment.checkoutTime = new Date();
    assignment.expectedReturnTime = defaultReturnTime;
    if (eventId) assignment.eventId = eventId;
    if (preUseChecklistSnapshot) assignment.preUseChecklistSnapshot = preUseChecklistSnapshot;
    if (checkoutNotes) assignment.checkoutNotes = checkoutNotes;
    if (conditionAtCheckout) assignment.conditionAtCheckout = conditionAtCheckout;
    await assignment.save();
  } else {
    assignment = await EquipmentAssignment.create({
      festId: resolvedFestId,
      equipmentId: equipment._id,
      eventId: eventId || null,
      assignedHolderId: targetHolderId,
      issuedById: req.user._id,
      status: 'checked_out',
      allocatedAt: new Date(),
      checkoutTime: new Date(),
      expectedReturnTime: defaultReturnTime,
      preUseChecklistSnapshot: preUseChecklistSnapshot || [],
      checkoutNotes: checkoutNotes || '',
      conditionAtCheckout: conditionAtCheckout || equipment.condition
    });
  }

  // Audit
  await auditService.log({
    festId: resolvedFestId,
    actorId: req.user._id,
    action: 'EQUIPMENT_CHECKED_OUT',
    targetEntity: { entityType: 'Equipment', entityId: equipment._id },
    changes: {
      status: 'checked_out',
      currentCustodianId: targetHolderId,
      issuedById: req.user._id
    },
    reason: checkoutNotes || 'Direct equipment checkout / pickup',
    req
  });

  // Notify holder if issued by coordinator
  if (String(targetHolderId) !== String(req.user._id)) {
    const holder = await User.findById(targetHolderId);
    if (holder) {
      await notificationService.createNotification({
        recipientId: targetHolderId,
        type: 'equipment_due',
        title: `Camera Checked Out: ${equipment.equipmentId}`,
        message: `${req.user.name} checked out ${equipment.brandModel} (${equipment.equipmentId}) to you. Return expected by ${defaultReturnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        relatedEntity: { entityType: 'Equipment', entityId: equipment._id }
      });
    }
  }

  // Return populated data
  const populatedEquipment = await Equipment.findById(equipment._id)
    .populate('currentCustodianId', 'name email role seniority phone')
    .populate('addedBy', 'name email role seniority');

  const populatedAssignment = await EquipmentAssignment.findById(assignment._id)
    .populate('assignedHolderId', 'name email role seniority phone')
    .populate('issuedById', 'name email role seniority')
    .populate('eventId', 'name category date startTime endTime');

  return success(res, {
    equipment: populatedEquipment,
    assignment: populatedAssignment
  }, `Successfully checked out ${equipment.equipmentId}`);
});

module.exports = {
  listEquipment,
  getEquipmentById,
  createEquipment,
  updateCondition,
  reserveEquipment,
  allocateEquipment,
  checkoutEquipment,
  takeEquipment,
  returnEquipment,
  reportLost,
  sendToMaintenance,
  restoreFromMaintenance,
  checkSequentialFeasibility
};
