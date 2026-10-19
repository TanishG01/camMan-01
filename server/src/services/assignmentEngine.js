const Event = require('../models/Event');
const Venue = require('../models/Venue');
const User = require('../models/User');
const EventAssignment = require('../models/EventAssignment');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');

/**
 * Calculates fitness score for a candidate on an event
 */
const scoreMemberForEvent = (member, event, venueMap, todaysAssignments) => {
  // 0. HARD CONSTRAINT: 4th year exclusion (4th-year members are never auto-allocated to events)
  if (member.seniority === '4th_year') {
    return -Infinity;
  }

  const eventStart = new Date(event.startTime).getTime();
  const eventEnd = new Date(event.endTime).getTime();

  // 1. HARD CONSTRAINT: Availability check
  if (member.availability && member.availability.length > 0) {
    const festSlot = member.availability.find(a =>
      String(a.festId) === String(event.festId) &&
      new Date(a.date).toDateString() === new Date(event.date).toDateString()
    );
    if (festSlot && !festSlot.isAvailable) {
      return -Infinity; // Member explicitly marked unavailable
    }
  }

  // 2. HARD CONSTRAINT: Overlap check
  const memberAssignments = todaysAssignments.filter(a => String(a.memberId) === String(member._id));

  for (const assign of memberAssignments) {
    if (!assign.eventId) continue;
    const existingStart = new Date(assign.eventId.startTime).getTime();
    const existingEnd = new Date(assign.eventId.endTime).getTime();

    // Time collision
    if (eventStart < existingEnd && eventEnd > existingStart) {
      return -Infinity;
    }

    // 3. HARD CONSTRAINT: Venue travel feasibility
    if (existingEnd <= eventStart) {
      const prevVenue = venueMap.get(String(assign.eventId.venueId));
      const bufferMs = (prevVenue?.travelBufferMinutes || 10) * 60 * 1000;
      if (eventStart - existingEnd < bufferMs) {
        return -Infinity; // Cannot travel in time
      }
    }
  }

  // SOFT SCORING
  let score = 100;

  // Skill match (+30 per matching skill)
  const requiredSkills = event.requiredSkills || ['photography'];
  const matched = (member.skills || []).filter(s => requiredSkills.includes(s));
  score += matched.length * 30;

  // Workload balancing (-25 per assignment already given today)
  score -= (memberAssignments.length * 25);

  // Priority & Seniority bonuses
  const isHighSeniority = member.seniority === '3rd_year';
  if (event.priority === 'critical' && isHighSeniority) {
    score += 40;
  } else if (event.priority === 'high' && ['2nd_year', '3rd_year'].includes(member.seniority)) {
    score += 20;
  }

  return score;
};

// Allowed Seniority Allocation Pairs:
// - 1st year can allocate with 2nd year
// - 2nd year can allocate with 3rd year
// - 1st year can allocate with 3rd year
const ALLOWED_SENIORITY_PAIRS = new Set([
  '1st_year:2nd_year',
  '2nd_year:1st_year',
  '2nd_year:3rd_year',
  '3rd_year:2nd_year',
  '1st_year:3rd_year',
  '3rd_year:1st_year'
]);

const isAllowedSeniorityPair = (s1, s2) => ALLOWED_SENIORITY_PAIRS.has(`${s1}:${s2}`);

/**
 * Selects the highest-scoring team adhering to seniority allocation constraints:
 * - 1st year with 2nd year
 * - 2nd year with 3rd year
 * - 1st year with 3rd year
 */
const selectBestTeam = (scored, teamSize) => {
  if (!scored || scored.length === 0) return [];

  // For solo events, 1st years cannot do solo coverage without a senior
  if (teamSize <= 1) {
    const solo = scored.find(r => r.member.seniority !== '1st_year');
    return solo ? [solo.member] : [scored[0].member];
  }

  // 1. Search for highest-scoring pair strictly adhering to the allowed combinations
  let bestPair = null;
  let bestPairScore = -Infinity;

  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const s1 = scored[i].member.seniority;
      const s2 = scored[j].member.seniority;
      if (isAllowedSeniorityPair(s1, s2)) {
        const pairScore = scored[i].score + scored[j].score;
        if (pairScore > bestPairScore) {
          bestPairScore = pairScore;
          bestPair = [scored[i].member, scored[j].member];
        }
      }
    }
  }

  let selected = [];
  if (bestPair) {
    selected = [...bestPair];
  } else {
    // Fallback: If no cross-year combination exists among available candidates,
    // prefer non-1st-years over two 1st-years
    const nonFirstYears = scored.filter(r => r.member.seniority !== '1st_year');
    if (nonFirstYears.length >= 2) {
      selected = nonFirstYears.slice(0, 2).map(r => r.member);
    } else {
      selected = scored.slice(0, Math.min(2, scored.length)).map(r => r.member);
    }
  }

  // If teamSize > 2, expand the team with remaining highest scoring candidates
  if (teamSize > selected.length) {
    const selectedIds = new Set(selected.map(m => String(m._id)));
    const remaining = scored.filter(r => !selectedIds.has(String(r.member._id)));

    for (const item of remaining) {
      if (selected.length >= teamSize) break;
      // If candidate is 1st year, ensure selected has at least one senior
      if (item.member.seniority === '1st_year') {
        const hasSenior = selected.some(m => ['2nd_year', '3rd_year'].includes(m.seniority));
        if (!hasSenior) continue;
      }
      selected.push(item.member);
    }
  }

  return selected;
};

/**
 * Suggests members for an event and applies junior-senior mentorship pairing
 */
const suggestAssignments = async (eventId) => {
  const event = await Event.findById(eventId).populate('venueId');
  if (!event) throw new ApiError(404, 'Event not found.');

  const festId = event.festId;
  const targetDate = new Date(event.date);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Load all venues for travel buffer calculation
  const venues = await Venue.find({ festId });
  const venueMap = new Map(venues.map(v => [String(v._id), v]));

  // Load all assignments on this day
  const todaysAssignments = await EventAssignment.find({
    festId,
    status: { $in: ['suggested', 'approved'] }
  }).populate('eventId');

  // Load all active members (strictly excluding 4th years from auto-matching)
  const candidates = await User.find({ isActive: true, seniority: { $ne: '4th_year' } });

  // Score each candidate
  const scored = candidates
    .map(member => ({
      member,
      score: scoreMemberForEvent(member, event, venueMap, todaysAssignments)
    }))
    .filter(r => r.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  const teamSize = event.teamSizeRequired || 2;
  const selected = selectBestTeam(scored, teamSize);

  // Separate members by seniority for mentorship pairing
  const thirdYears = selected.filter(m => m.seniority === '3rd_year');
  const secondYears = selected.filter(m => m.seniority === '2nd_year');

  const suggestions = [];

  for (const member of selected) {
    let mentorId = null;
    let isMentorNeeded = false;

    if (member.seniority === '1st_year') {
      // 1st year can allocate with 2nd year or 3rd year
      if (secondYears.length > 0) {
        mentorId = secondYears[0]._id;
      } else if (thirdYears.length > 0) {
        mentorId = thirdYears[0]._id;
      } else {
        isMentorNeeded = true; // No senior in group -> flagged!
      }
    } else if (member.seniority === '2nd_year') {
      // 2nd year can allocate with 3rd year as lead mentor
      if (thirdYears.length > 0) {
        mentorId = thirdYears[0]._id;
      }
      isMentorNeeded = false;
    } else if (member.seniority === '3rd_year') {
      mentorId = null;
      isMentorNeeded = false;
    }

    // Role assignment
    let roleInEvent = 'photographer';
    if (event.requiredDeliverables?.includes('videos') && member.skills?.includes('videography')) {
      roleInEvent = 'videographer';
    } else if (member.seniority === '3rd_year') {
      roleInEvent = 'lead_photographer';
    }

    // Upsert suggestion
    const existing = await EventAssignment.findOne({ eventId: event._id, memberId: member._id });
    if (!existing) {
      const assignment = await EventAssignment.create({
        festId,
        eventId: event._id,
        memberId: member._id,
        roleInEvent,
        status: 'suggested',
        mentorId,
        isMentorNeeded
      });
      suggestions.push(assignment);
    } else {
      if (mentorId && !existing.mentorId) {
        existing.mentorId = mentorId;
        existing.isMentorNeeded = isMentorNeeded;
        await existing.save();
      }
      suggestions.push(existing);
    }
  }

  // Notify coordinators
  const admins = await User.find({ role: 'admin', isActive: true });
  await notificationService.notifyMany(admins.map(a => a._id), {
    type: 'assignment_suggested',
    title: `Assignments Suggested: "${event.name}"`,
    message: `${suggestions.length} member(s) suggested for "${event.name}". Review and approve.`,
    relatedEntity: { entityType: 'Event', entityId: event._id }
  });

  return suggestions;
};

module.exports = {
  scoreMemberForEvent,
  suggestAssignments,
  selectBestTeam,
  isAllowedSeniorityPair,
  ALLOWED_SENIORITY_PAIRS
};
