module.exports = {
  ROLES: ['admin', 'senior', 'junior'],
  SENIORITY: ['1st_year', '2nd_year', '3rd_year', '4th_year'],
  SKILLS: ['photography', 'videography', 'drone', 'editing', 'reels'],

  FEST_STATUS: ['upcoming', 'active', 'completed', 'archived'],

  EVENT_STATUS: ['scheduled', 'in_progress', 'completed', 'delayed', 'cancelled'],
  EVENT_PRIORITY: ['low', 'medium', 'high', 'critical'],
  DELIVERABLES: ['photos', 'videos', 'reels', 'highlights', 'bts'],

  ASSIGNMENT_STATUS: ['suggested', 'approved', 'rejected', 'reassigned'],
  ASSIGNMENT_ROLE_IN_EVENT: ['lead_photographer', 'photographer', 'videographer', 'shadow_trainee'],

  EQUIPMENT_CATEGORY: ['camera', 'lens', 'sd_card', 'battery', 'charger', 'tripod', 'gimbal', 'flash', 'other'],
  EQUIPMENT_CONDITION: ['excellent', 'good', 'fair', 'damaged', 'lost'],
  EQUIPMENT_STATUS: ['available', 'reserved', 'allocated', 'checked_out', 'return_pending', 'maintenance', 'lost'],

  EQUIPMENT_ASSIGNMENT_STATUS: ['reserved', 'allocated', 'checked_out', 'return_pending', 'returned', 'cancelled'],

  COVERAGE_STATUS: ['not_started', 'in_progress', 'covered', 'partially_covered', 'missed', 'requires_review'],
  COVERAGE_VALIDATION: ['pending_review', 'approved', 'rejected'],

  HANDOVER_STATUS: ['not_yet_handed_over', 'handover_pending', 'handed_over'],
  BACKUP_STATUS: ['backup_pending', 'backed_up', 'issue'],
  VERIFICATION_STATUS: ['unverified', 'verified', 'issue_recheck_required'],

  NOTIFICATION_TYPES: [
    'assignment_suggested', 'assignment_approved', 'assignment_rejected',
    'mentor_needed', 'mentor_assigned',
    'schedule_change', 'event_delayed', 'event_cancelled',
    'replacement_request', 'replacement_assigned',
    'equipment_due', 'equipment_overdue', 'equipment_returned',
    'handover_reminder', 'handover_confirmed',
    'footage_issue', 'backup_failed', 'coverage_validated'
  ],

  AUDIT_ACTIONS: [
    'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED', 'FEST_CREATED', 'FEST_UPDATED', 'FEST_DELETED',
    'VENUE_CREATED', 'VENUE_UPDATED',
    'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELAYED', 'EVENT_CANCELLED', 'EVENT_DELETED',
    'EVENTS_IMPORTED',
    'ASSIGNMENT_CREATED', 'ASSIGNMENT_REMOVED', 'ASSIGNMENT_SUGGESTED', 'ASSIGNMENT_APPROVED', 'ASSIGNMENT_REJECTED',
    'ASSIGNMENT_REASSIGNED', 'MENTOR_ASSIGNED', 'MENTOR_FLAGGED',
    'EQUIPMENT_ADDED', 'EQUIPMENT_RESERVED', 'EQUIPMENT_ALLOCATED',
    'EQUIPMENT_CHECKED_OUT', 'EQUIPMENT_RETURNED', 'EQUIPMENT_DAMAGED', 'EQUIPMENT_LOST',
    'COVERAGE_SUBMITTED', 'COVERAGE_VALIDATED', 'UNPLANNED_COVERAGE_SUBMITTED',
    'SD_HANDOVER_CONFIRMED', 'BACKUP_UPDATED', 'FOOTAGE_VERIFIED', 'FOOTAGE_ISSUE_FLAGGED',
    'AUDIT_EXPORTED'
  ]
};
