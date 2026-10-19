const Equipment = require('../models/Equipment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const ApiError = require('../utils/ApiError');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

/**
 * Case 8: Atomic Equipment Allocation with Concurrency Guard
 */
const allocateEquipmentAtomically = async (equipmentId, holderId, eventId, festId, expectedReturnTime, actorUser, req = null) => {
  // Step 1: Atomic conditional update
  // The equipment MUST match status: 'available' or 'reserved'
  const updated = await Equipment.findOneAndUpdate(
    {
      _id: equipmentId,
      status: { $in: ['available', 'reserved'] }
    },
    {
      $set: {
        status: 'allocated',
        currentCustodianId: holderId,
        updatedAt: new Date()
      }
    },
    { new: true }
  );

  // Step 2: Concurrency collision check
  if (!updated) {
    const current = await Equipment.findById(equipmentId).populate('currentCustodianId', 'name email');
    throw new ApiError(409,
      `Equipment "${current?.equipmentId || equipmentId}" is no longer available. ` +
      `Current status: "${current?.status || 'unknown'}". ` +
      (current?.currentCustodianId
        ? `Currently allocated to/held by: ${current.currentCustodianId.name} (${current.currentCustodianId.email}).`
        : 'No current custodian on record.')
    );
  }

  // Step 3: Create tracking record
  const assignment = await EquipmentAssignment.create({
    festId,
    equipmentId,
    eventId: eventId || null,
    assignedHolderId: holderId,
    status: 'allocated',
    allocatedAt: new Date(),
    expectedReturnTime: expectedReturnTime ? new Date(expectedReturnTime) : new Date(Date.now() + 6 * 3600000)
  });

  await auditService.log({
    festId,
    actorId: actorUser._id,
    action: 'EQUIPMENT_ALLOCATED',
    targetEntity: { entityType: 'Equipment', entityId: equipmentId },
    changes: { status: 'allocated', holderId },
    req
  });

  return { equipment: updated, assignment };
};

/**
 * Physical Checkout with Pre-use Checklist Snapshot
 */
const checkoutEquipment = async (equipmentId, { issuedById, preUseChecklistSnapshot, checkoutNotes, conditionAtCheckout, expectedReturnTime }, actorUser, req = null) => {
  const equipment = await Equipment.findById(equipmentId);
  if (!equipment) throw new ApiError(404, 'Equipment not found.');

  if (equipment.status !== 'allocated') {
    throw new ApiError(400, `Cannot check out equipment in "${equipment.status}" status. It must be in "allocated" status.`);
  }

  // Find active assignment
  const assignment = await EquipmentAssignment.findOne({
    equipmentId: equipment._id,
    status: 'allocated'
  }).sort({ createdAt: -1 });

  if (!assignment) {
    throw new ApiError(400, 'No active allocation record found for this equipment.');
  }

  equipment.status = 'checked_out';
  if (conditionAtCheckout) equipment.condition = conditionAtCheckout;
  await equipment.save();

  assignment.status = 'checked_out';
  assignment.checkoutTime = new Date();
  assignment.issuedById = issuedById || actorUser._id;
  assignment.preUseChecklistSnapshot = preUseChecklistSnapshot || [];
  assignment.checkoutNotes = checkoutNotes || '';
  if (conditionAtCheckout) assignment.conditionAtCheckout = conditionAtCheckout;
  if (expectedReturnTime) assignment.expectedReturnTime = new Date(expectedReturnTime);
  await assignment.save();

  await auditService.log({
    festId: assignment.festId,
    actorId: actorUser._id,
    action: 'EQUIPMENT_CHECKED_OUT',
    targetEntity: { entityType: 'Equipment', entityId: equipment._id },
    changes: { status: 'checked_out', conditionAtCheckout },
    req
  });

  return { equipment, assignment };
};

/**
 * Case 5: Independent Return Workflow
 * Camera return and SD card return are separate calls.
 */
const returnEquipment = async (equipmentId, { conditionAtReturn, returnNotes, returnReceivedById }, actorUser, req = null) => {
  const equipment = await Equipment.findById(equipmentId);
  if (!equipment) throw new ApiError(404, 'Equipment not found.');

  if (!['checked_out', 'return_pending'].includes(equipment.status)) {
    throw new ApiError(400, `Cannot return equipment in "${equipment.status}" status. It must be "checked_out" or "return_pending".`);
  }

  const assignment = await EquipmentAssignment.findOne({
    equipmentId: equipment._id,
    status: { $in: ['checked_out', 'return_pending'] }
  }).sort({ createdAt: -1 });

  const finalStatus = conditionAtReturn === 'damaged' ? 'maintenance' : 'available';

  equipment.status = finalStatus;
  equipment.currentCustodianId = null;
  if (conditionAtReturn) equipment.condition = conditionAtReturn;
  if (conditionAtReturn === 'damaged') {
    equipment.maintenanceNotes = returnNotes || 'Damaged upon return';
  }
  await equipment.save();

  if (assignment) {
    assignment.status = 'returned';
    assignment.actualReturnTime = new Date();
    assignment.conditionAtReturn = conditionAtReturn || equipment.condition;
    assignment.returnNotes = returnNotes || '';
    assignment.returnReceivedById = returnReceivedById || actorUser._id;
    await assignment.save();
  }

  await auditService.log({
    festId: assignment?.festId || null,
    actorId: actorUser._id,
    action: conditionAtReturn === 'damaged' ? 'EQUIPMENT_DAMAGED' : 'EQUIPMENT_RETURNED',
    targetEntity: { entityType: 'Equipment', entityId: equipment._id },
    changes: { status: finalStatus, conditionAtReturn },
    reason: returnNotes,
    req
  });

  return { equipment, assignment };
};

/**
 * Case 3: Sequential Camera Feasibility Check
 */
const checkSequentialFeasibility = async (equipmentId, event1Id, event2Id) => {
  const [event1, event2] = await Promise.all([
    Event.findById(event1Id).populate('venueId'),
    Event.findById(event2Id).populate('venueId')
  ]);

  if (!event1 || !event2) throw new ApiError(404, 'Both events must be valid.');

  const e1End = new Date(event1.endTime).getTime();
  const e2Start = new Date(event2.startTime).getTime();
  const travelBufferMin = event1.venueId?.travelBufferMinutes || 10;
  const travelBufferMs = travelBufferMin * 60 * 1000;

  const bufferAvailableMs = e2Start - e1End;
  const feasible = bufferAvailableMs >= travelBufferMs;

  return {
    feasible,
    travelBufferNeededMinutes: travelBufferMin,
    bufferAvailableMinutes: Math.round(bufferAvailableMs / 60000),
    shortfallMinutes: feasible ? 0 : Math.round((travelBufferMs - bufferAvailableMs) / 60000),
    minCoverageDurationEvent1: event1.minCoverageDurationMinutes,
    minCoverageDurationEvent2: event2.minCoverageDurationMinutes
  };
};

module.exports = {
  allocateEquipmentAtomically,
  checkoutEquipment,
  returnEquipment,
  checkSequentialFeasibility
};
