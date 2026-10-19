const EventAssignment = require('../models/EventAssignment');
const Event = require('../models/Event');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const assignmentEngine = require('../services/assignmentEngine');

const getAssignments = asyncHandler(async (req, res) => {
  const { eventId, memberId, festId, status, isMentorNeeded } = req.query;
  const filter = {};

  if (eventId) filter.eventId = eventId;
  if (memberId) filter.memberId = memberId;
  if (festId) filter.festId = festId;
  if (status) filter.status = status;
  if (isMentorNeeded !== undefined) filter.isMentorNeeded = isMentorNeeded === 'true';

  const assignments = await EventAssignment.find(filter)
    .populate('eventId', 'name category date startTime endTime venueId priority status')
    .populate('memberId', 'name email role seniority skills')
    .populate('mentorId', 'name email role seniority')
    .sort({ createdAt: -1 });

  return success(res, { assignments, count: assignments.length }, 'Assignments retrieved');
});

const suggestAssignments = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) throw new ApiError(400, 'eventId is required.');

  const suggestions = await assignmentEngine.suggestAssignments(eventId);

  const populated = await EventAssignment.find({ _id: { $in: suggestions.map(s => s._id) } })
    .populate('memberId', 'name email role seniority skills')
    .populate('mentorId', 'name email role seniority');

  return success(res, { suggestions: populated }, 'Assignment suggestions generated');
});

const approveAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignment = await EventAssignment.findById(id).populate('memberId').populate('eventId');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  assignment.status = 'approved';
  assignment.approvedBy = req.user._id;
  assignment.approvedAt = new Date();

  // Mentorship validation check (Case 2)
  if (assignment.memberId.seniority === '1st_year' && !assignment.mentorId) {
    assignment.isMentorNeeded = true;

    // Notify seniors & admins
    const seniorsAndAdmins = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
    await notificationService.notifyMany(seniorsAndAdmins.map(u => u._id), {
      type: 'mentor_needed',
      title: `Mentor Needed: ${assignment.memberId.name}`,
      message: `1st-year member ${assignment.memberId.name} was approved for "${assignment.eventId.name}" without an assigned senior mentor.`,
      relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
    });
  }

  await assignment.save();

  // Notify member
  await notificationService.createNotification({
    recipientId: assignment.memberId._id,
    type: 'assignment_approved',
    title: `Assignment Approved: "${assignment.eventId.name}"`,
    message: `You are confirmed to cover "${assignment.eventId.name}".`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'ASSIGNMENT_APPROVED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    changes: { status: 'approved', isMentorNeeded: assignment.isMentorNeeded },
    req
  });

  return success(res, { assignment }, 'Assignment approved successfully');
});

const rejectAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const assignment = await EventAssignment.findById(id);
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  assignment.status = 'rejected';
  assignment.rejectionReason = reason || 'Rejected by coordinator';
  await assignment.save();

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'ASSIGNMENT_REJECTED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    reason: reason || 'Assignment rejected',
    req
  });

  return success(res, { assignment }, 'Assignment rejected');
});

const reassignMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newMemberId, reason } = req.body;

  if (!newMemberId || !reason) {
    throw new ApiError(400, 'newMemberId and reason are required for reassignment.');
  }

  const assignment = await EventAssignment.findById(id).populate('eventId');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  const newMember = await User.findById(newMemberId);
  if (!newMember) throw new ApiError(404, 'New member not found.');

  const originalMemberId = assignment.memberId;

  // Preserve in reassignment history
  assignment.reassignmentHistory.push({
    originalMemberId,
    replacedByMemberId: newMember._id,
    reason,
    approvedBy: req.user._id,
    timestamp: new Date()
  });

  assignment.memberId = newMember._id;
  assignment.status = 'approved';

  // Check mentorship for new member
  if (newMember.seniority === '1st_year' && !assignment.mentorId) {
    assignment.isMentorNeeded = true;
  } else if (newMember.seniority !== '1st_year') {
    assignment.isMentorNeeded = false;
  }

  await assignment.save();

  // Notify original member and new member
  await notificationService.createNotification({
    recipientId: originalMemberId,
    type: 'replacement_request',
    title: `Reassigned from "${assignment.eventId.name}"`,
    message: `You were replaced on "${assignment.eventId.name}". Reason: ${reason}`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await notificationService.createNotification({
    recipientId: newMember._id,
    type: 'replacement_assigned',
    title: `Assigned as Replacement: "${assignment.eventId.name}"`,
    message: `You have been assigned to cover "${assignment.eventId.name}". Reason: ${reason}`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'ASSIGNMENT_REASSIGNED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    changes: { originalMemberId, replacedByMemberId: newMember._id },
    reason,
    req
  });

  return success(res, { assignment }, 'Member reassigned successfully with history preserved');
});

const assignMentor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mentorId } = req.body;

  if (!mentorId) throw new ApiError(400, 'mentorId is required.');

  const mentor = await User.findById(mentorId);
  if (!mentor) throw new ApiError(404, 'Mentor user not found.');
  if (mentor.seniority === '4th_year') {
    throw new ApiError(400, '4th-year members cannot be designated as mentors.');
  }
  if (mentor.seniority === '1st_year') {
    throw new ApiError(400, 'A 1st-year member cannot be designated as a senior mentor.');
  }

  const assignment = await EventAssignment.findById(id).populate('memberId').populate('eventId');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  const memberSeniority = assignment.memberId?.seniority;
  if (memberSeniority === '1st_year' && !['2nd_year', '3rd_year'].includes(mentor.seniority)) {
    throw new ApiError(400, 'A 1st-year member can only be mentored by a 2nd or 3rd-year member.');
  }
  if (memberSeniority === '2nd_year' && mentor.seniority !== '3rd_year') {
    throw new ApiError(400, 'A 2nd-year member can only be mentored by a 3rd-year member.');
  }
  if (memberSeniority === '3rd_year') {
    throw new ApiError(400, '3rd-year members are senior leads and do not require a mentor.');
  }

  assignment.mentorId = mentor._id;
  assignment.isMentorNeeded = false;
  await assignment.save();

  // Notify junior and senior
  await notificationService.createNotification({
    recipientId: assignment.memberId._id,
    type: 'mentor_assigned',
    title: `Mentor Assigned: ${mentor.name}`,
    message: `${mentor.name} (${mentor.seniority.replace('_', ' ')}) will mentor you on "${assignment.eventId.name}".`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await notificationService.createNotification({
    recipientId: mentor._id,
    type: 'mentor_assigned',
    title: `Mentorship Duty: ${assignment.memberId.name}`,
    message: `You are mentoring ${assignment.memberId.name} on "${assignment.eventId.name}".`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'MENTOR_ASSIGNED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    changes: { mentorId: mentor._id },
    reason: `Assigned ${mentor.name} as mentor`,
    req
  });

  return success(res, { assignment }, `Assigned ${mentor.name} as mentor`);
});

const requestMentor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignment = await EventAssignment.findById(id).populate('memberId').populate('eventId');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  assignment.isMentorNeeded = true;
  await assignment.save();

  // Notify seniors and admins
  const seniors = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
  await notificationService.notifyMany(seniors.map(s => s._id), {
    type: 'mentor_needed',
    title: `Mentor Requested: "${assignment.eventId.name}"`,
    message: `${req.user.name} requested a senior mentor for "${assignment.eventId.name}".`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'MENTOR_FLAGGED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    reason: 'Mentor needed flag raised by user',
    req
  });

  return success(res, { assignment }, 'Mentor needed alert raised');
});

const confirmContribution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { actuallyContributed } = req.body;

  if (typeof actuallyContributed !== 'boolean') {
    throw new ApiError(400, 'actuallyContributed boolean is required.');
  }

  const assignment = await EventAssignment.findById(id);
  if (!assignment) throw new ApiError(404, 'Assignment not found.');

  assignment.actuallyContributed = actuallyContributed;
  await assignment.save();

  return success(res, { assignment }, 'Contribution confirmation updated');
});

/**
 * POST /api/v1/assignments
 * Admin/Senior manually assigns a team member to an event
 */
const createAssignment = asyncHandler(async (req, res) => {
  const { festId, eventId, memberId, roleInEvent, mentorId } = req.body;

  if (!festId || !eventId || !memberId) {
    throw new ApiError(400, 'festId, eventId, and memberId are required.');
  }

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, 'Event not found.');

  const member = await User.findById(memberId);
  if (!member) throw new ApiError(404, 'Team member not found.');

  const existing = await EventAssignment.findOne({ eventId, memberId });
  if (existing) {
    throw new ApiError(400, `Member "${member.name}" is already assigned to this event.`);
  }

  let finalMentorId = mentorId || null;
  let isMentorNeeded = false;

  if (finalMentorId) {
    const mentor = await User.findById(finalMentorId);
    if (!mentor) {
      throw new ApiError(404, 'Mentor user not found.');
    }
    if (mentor.seniority === '4th_year') {
      throw new ApiError(400, '4th-year members cannot be designated as mentors.');
    }
    if (mentor.seniority === '1st_year') {
      throw new ApiError(400, 'A 1st-year member cannot be designated as a mentor.');
    }
    if (member.seniority === '1st_year' && !['2nd_year', '3rd_year'].includes(mentor.seniority)) {
      throw new ApiError(400, 'A 1st-year member can only be mentored by a 2nd or 3rd-year member.');
    }
    if (member.seniority === '2nd_year' && mentor.seniority !== '3rd_year') {
      throw new ApiError(400, 'A 2nd-year member can only be mentored by a 3rd-year member.');
    }
    if (member.seniority === '3rd_year') {
      throw new ApiError(400, '3rd-year members are senior leads and do not require a mentor.');
    }
  } else if (member.seniority === '1st_year') {
    isMentorNeeded = true;
  }

  const assignment = await EventAssignment.create({
    festId,
    eventId,
    memberId,
    roleInEvent: roleInEvent || 'photographer',
    status: 'approved',
    mentorId: finalMentorId,
    isMentorNeeded,
    approvedBy: req.user._id,
    approvedAt: new Date(),
    isManualOverride: true,
    overrideReason: 'Manually allocated by coordinator'
  });

  // Notify member
  await notificationService.createNotification({
    recipientId: member._id,
    type: 'assignment_approved',
    title: `Assigned to "${event.name}"`,
    message: `You have been allocated to cover "${event.name}" as ${assignment.roleInEvent.replace('_', ' ')}.`,
    relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
  });

  // If mentor needed, notify seniors & admins
  if (isMentorNeeded) {
    const seniorsAndAdmins = await User.find({ role: { $in: ['admin', 'senior'] }, isActive: true });
    await notificationService.notifyMany(seniorsAndAdmins.map(u => u._id), {
      type: 'mentor_needed',
      title: `Mentor Needed: ${member.name}`,
      message: `1st-year member ${member.name} was allocated to "${event.name}" without a senior mentor.`,
      relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
    });
  }

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'ASSIGNMENT_CREATED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    changes: { eventId, memberId, roleInEvent: assignment.roleInEvent, isMentorNeeded },
    reason: 'Manually allocated by coordinator',
    req
  });

  const populated = await EventAssignment.findById(assignment._id)
    .populate('eventId', 'name category date startTime endTime venueId priority status')
    .populate('memberId', 'name email role seniority skills')
    .populate('mentorId', 'name email role seniority');

  return success(res, { assignment: populated }, 'Member assigned to event successfully', 201);
});

/**
 * DELETE /api/v1/assignments/:id
 * Admin/Senior removes an event assignment
 */
const deleteAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignment = await EventAssignment.findById(id).populate('eventId').populate('memberId');
  if (!assignment) {
    throw new ApiError(404, 'Assignment not found.');
  }

  await EventAssignment.findByIdAndDelete(id);

  if (assignment.memberId) {
    await notificationService.createNotification({
      recipientId: assignment.memberId._id,
      type: 'replacement_request',
      title: `Unassigned from "${assignment.eventId?.name || 'Event'}"`,
      message: `Your coverage assignment for "${assignment.eventId?.name || 'Event'}" was removed.`,
      relatedEntity: { entityType: 'EventAssignment', entityId: assignment._id }
    });
  }

  await auditService.log({
    festId: assignment.festId,
    actorId: req.user._id,
    action: 'ASSIGNMENT_REMOVED',
    targetEntity: { entityType: 'EventAssignment', entityId: assignment._id },
    changes: { deleted: true },
    reason: req.body.reason || 'Assignment removed by coordinator',
    req
  });

  return success(res, null, 'Assignment removed successfully');
});

module.exports = {
  getAssignments,
  suggestAssignments,
  approveAssignment,
  rejectAssignment,
  reassignMember,
  assignMentor,
  requestMentor,
  confirmContribution,
  createAssignment,
  deleteAssignment
};
