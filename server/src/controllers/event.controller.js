const Event = require('../models/Event');
const Venue = require('../models/Venue');
const EventAssignment = require('../models/EventAssignment');
const Equipment = require('../models/Equipment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const CoverageRecord = require('../models/CoverageRecord');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const importService = require('../services/importService');

const createEvent = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const {
    name, category, date, startTime, endTime, venueId,
    priority, teamSizeRequired, requiredSkills, requiredDeliverables,
    minCoverageDurationMinutes, equipmentRequirements, specialInstructions
  } = req.body;

  if (!name || !category || !date || !startTime || !endTime || !venueId) {
    throw new ApiError(400, 'Missing required fields: name, category, date, startTime, endTime, venueId.');
  }

  const venue = await Venue.findOne({ _id: venueId, festId });
  if (!venue) {
    throw new ApiError(404, 'Selected venue does not belong to this fest.');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid startTime or endTime ISO timestamp.');
  }
  if (start >= end) {
    throw new ApiError(400, 'startTime must be strictly before endTime.');
  }

  const event = await Event.create({
    festId,
    venueId,
    name: name.trim(),
    category: category.trim(),
    date: new Date(date),
    startTime: start,
    endTime: end,
    minCoverageDurationMinutes: minCoverageDurationMinutes || 15,
    requiredDeliverables: requiredDeliverables || ['photos', 'videos'],
    teamSizeRequired: teamSizeRequired || 2,
    requiredSkills: requiredSkills || ['photography'],
    priority: priority || 'medium',
    specialInstructions: specialInstructions || '',
    equipmentRequirements: equipmentRequirements || [],
    createdBy: req.user._id
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EVENT_CREATED',
    targetEntity: { entityType: 'Event', entityId: event._id },
    changes: { after: event.toObject() },
    req
  });

  return success(res, { event }, 'Event created successfully', 201);
});

const getEvents = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const { date, venueId, status, priority, search } = req.query;

  const filter = { festId };
  if (venueId) filter.venueId = venueId;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (date) {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    filter.date = { $gte: targetDate, $lt: nextDate };
  }
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const events = await Event.find(filter)
    .populate('venueId', 'name travelBufferMinutes setupBufferMinutes')
    .sort({ startTime: 1 });

  return success(res, { events, count: events.length }, 'Events retrieved');
});

const getEventById = asyncHandler(async (req, res) => {
  const { festId, eventId } = req.params;
  const event = await Event.findOne({ _id: eventId, festId })
    .populate('venueId')
    .populate('createdBy', 'name email');

  if (!event) throw new ApiError(404, 'Event not found.');

  const assignments = await EventAssignment.find({ eventId })
    .populate('memberId', 'name email role seniority skills')
    .populate('mentorId', 'name email role seniority');

  return success(res, { event, assignments }, 'Event details retrieved');
});

const updateEvent = asyncHandler(async (req, res) => {
  const { festId, eventId } = req.params;
  const { reason, ...updates } = req.body;

  const event = await Event.findOne({ _id: eventId, festId });
  if (!event) throw new ApiError(404, 'Event not found.');

  const before = event.toObject();
  const changeEntries = [];

  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined && JSON.stringify(event[key]) !== JSON.stringify(val)) {
      changeEntries.push({
        changedBy: req.user._id,
        changedAt: new Date(),
        fieldChanged: key,
        oldValue: event[key],
        newValue: val,
        reason: reason || 'Schedule / metadata update'
      });
      event[key] = val;
    }
  }

  if (changeEntries.length > 0) {
    event.changeHistory.push(...changeEntries);
    await event.save();

    await auditService.log({
      festId,
      actorId: req.user._id,
      action: 'EVENT_UPDATED',
      targetEntity: { entityType: 'Event', entityId: event._id },
      changes: { before, after: event.toObject() },
      reason: reason || 'Event metadata updated',
      req
    });
  }

  return success(res, { event }, 'Event updated successfully');
});

/**
 * Case 1: Delayed Event
 * Member prioritizes next assigned event. Flag delayed event, suggest replacements.
 */
const delayEvent = asyncHandler(async (req, res) => {
  const { festId, eventId } = req.params;
  const { newEndTime, reason } = req.body;

  if (!newEndTime) throw new ApiError(400, 'newEndTime ISO timestamp is required.');
  const newEnd = new Date(newEndTime);
  if (isNaN(newEnd.getTime())) throw new ApiError(400, 'Invalid newEndTime format.');

  const event = await Event.findOne({ _id: eventId, festId }).populate('venueId');
  if (!event) throw new ApiError(404, 'Event not found.');

  if (newEnd <= event.startTime) {
    throw new ApiError(400, 'newEndTime must be after event startTime.');
  }

  const originalEnd = event.endTime;
  event.status = 'delayed';
  event.delayInfo = {
    isDelayed: true,
    originalEndTime: originalEnd,
    newEndTime: newEnd,
    reason: reason || 'Delayed on ground',
    reportedBy: req.user._id,
    reportedAt: new Date()
  };
  event.endTime = newEnd;

  event.changeHistory.push({
    changedBy: req.user._id,
    changedAt: new Date(),
    fieldChanged: 'endTime (delay)',
    oldValue: originalEnd,
    newValue: newEnd,
    reason: reason || 'Event delayed'
  });

  await event.save();

  // Find all approved assignments for this event
  const assignments = await EventAssignment.find({ eventId, status: 'approved' });
  const conflictingMembers = [];

  // Check each member's subsequent assignments
  for (const assign of assignments) {
    const nextAssignment = await EventAssignment.findOne({
      festId,
      memberId: assign.memberId,
      status: 'approved',
      _id: { $ne: assign._id }
    }).populate('eventId');

    if (nextAssignment?.eventId) {
      const nextStart = new Date(nextAssignment.eventId.startTime);
      if (nextStart < newEnd) {
        conflictingMembers.push({
          memberId: assign.memberId,
          conflictingEvent: nextAssignment.eventId
        });
      }
    }
  }

  // Notify team leads & coordinators
  const adminsAndSeniors = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
  const recipientIds = adminsAndSeniors.map(u => u._id);

  await notificationService.notifyMany(recipientIds, {
    type: 'event_delayed',
    title: `Event Delayed: "${event.name}"`,
    message: `"${event.name}" is delayed until ${newEnd.toLocaleTimeString()}. ${conflictingMembers.length} member(s) have overlapping next assignments needing reassignment.`,
    relatedEntity: { entityType: 'Event', entityId: event._id }
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EVENT_DELAYED',
    targetEntity: { entityType: 'Event', entityId: event._id },
    changes: { originalEndTime: originalEnd, newEndTime: newEnd },
    reason: reason || 'Event delayed',
    req
  });

  return success(res, {
    event,
    conflictsDetected: conflictingMembers.length,
    conflictingMembers
  }, `Event "${event.name}" marked as delayed. Coverage review required.`);
});

/**
 * Case 4: Event Cancelled
 * Cancelling event does NOT automatically return equipment.
 */
const cancelEvent = asyncHandler(async (req, res) => {
  const { festId, eventId } = req.params;
  const { reason } = req.body;

  const event = await Event.findOne({ _id: eventId, festId });
  if (!event) throw new ApiError(404, 'Event not found.');

  event.status = 'cancelled';
  event.cancellationInfo = {
    cancelledAt: new Date(),
    cancelledBy: req.user._id,
    reason: reason || 'Cancelled by coordinator/team'
  };

  event.changeHistory.push({
    changedBy: req.user._id,
    changedAt: new Date(),
    fieldChanged: 'status (cancelled)',
    oldValue: 'scheduled',
    newValue: 'cancelled',
    reason: reason || 'Event cancelled'
  });

  await event.save();

  // Check if any equipment is currently checked out for this event
  const checkedOutGear = await EquipmentAssignment.find({
    eventId,
    status: 'checked_out'
  }).populate('equipmentId assignedHolderId');

  // Notify team leads about equipment return requirement
  const adminsAndSeniors = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
  const recipientIds = adminsAndSeniors.map(u => u._id);

  await notificationService.notifyMany(recipientIds, {
    type: 'event_cancelled',
    title: `Event Cancelled: "${event.name}"`,
    message: `Event "${event.name}" was cancelled. ${checkedOutGear.length} equipment item(s) remain checked out and must be physically returned.`,
    relatedEntity: { entityType: 'Event', entityId: event._id }
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EVENT_CANCELLED',
    targetEntity: { entityType: 'Event', entityId: event._id },
    changes: { status: 'cancelled', cancellationInfo: event.cancellationInfo },
    reason: reason || 'Event cancelled',
    req
  });

  return success(res, {
    event,
    checkedOutEquipmentPendingReturn: checkedOutGear.map(g => ({
      equipmentId: g.equipmentId.equipmentId,
      holder: g.assignedHolderId.name
    }))
  }, `Event "${event.name}" cancelled. Equipment checkouts remain active until physical return.`);
});

/**
 * Excel Schedule Import Preview
 */
const importPreview = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  if (!req.file) {
    throw new ApiError(400, 'Please upload an Excel file (.xlsx).');
  }

  const preview = await importService.generatePreview(req.file.buffer, festId);
  return success(res, preview, 'Schedule import preview generated');
});

/**
 * Excel Schedule Import Commit
 */
const importCommit = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const { previewToken, rowIndexes } = req.body;

  if (!previewToken || !Array.isArray(rowIndexes)) {
    throw new ApiError(400, 'previewToken and rowIndexes array are required.');
  }

  const result = await importService.commitImport(previewToken, rowIndexes, req.user._id);

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EVENTS_IMPORTED',
    targetEntity: { entityType: 'Fest', entityId: festId },
    changes: { count: result.importedCount },
    reason: `Imported ${result.importedCount} events from Excel sheet`,
    req
  });

  return success(res, result, `Successfully imported ${result.importedCount} events.`);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const { festId, eventId } = req.params;
  const event = await Event.findOne({ _id: eventId, festId });
  if (!event) {
    throw new ApiError(404, 'Event not found.');
  }

  // Free equipment reserved or allocated specifically for this event
  const reservedOrAllocated = await EquipmentAssignment.find({
    eventId,
    status: { $in: ['reserved', 'allocated'] }
  });
  const eqIdsToFree = reservedOrAllocated.map(a => a.equipmentId);
  if (eqIdsToFree.length > 0) {
    await Equipment.updateMany(
      { _id: { $in: eqIdsToFree }, status: { $in: ['reserved', 'allocated'] } },
      { $set: { status: 'available', currentCustodianId: null } }
    );
  }

  // Delete reserved/allocated/cancelled assignments for this event
  await EquipmentAssignment.deleteMany({
    eventId,
    status: { $in: ['reserved', 'allocated', 'cancelled'] }
  });

  // For checked_out gear, unlink eventId so gear records remain physically accounted for
  await EquipmentAssignment.updateMany(
    { eventId },
    { $set: { eventId: null } }
  );

  // Cascading deletes for EventAssignment and CoverageRecord
  await Promise.all([
    EventAssignment.deleteMany({ eventId }),
    CoverageRecord.deleteMany({ eventId }),
    Event.findByIdAndDelete(eventId)
  ]);

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'EVENT_DELETED',
    targetEntity: { entityType: 'Event', entityId: event._id },
    changes: { before: event.toObject() },
    reason: `Event "${event.name}" deleted by ${req.user.role}`,
    req
  });

  return success(res, { deletedEventId: eventId }, `Event "${event.name}" deleted successfully`);
});

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  delayEvent,
  cancelEvent,
  importPreview,
  importCommit
};
