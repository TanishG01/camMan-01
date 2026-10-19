const { scoreMemberForEvent } = require('../../src/services/assignmentEngine');

describe('Assignment Engine Scoring Logic', () => {
  const baseVenue = {
    _id: 'v1',
    travelBufferMinutes: 10
  };
  const venueMap = new Map([['v1', baseVenue]]);

  const baseEvent = {
    festId: 'fest1',
    date: new Date('2026-10-20'),
    startTime: new Date('2026-10-20T10:00:00Z'),
    endTime: new Date('2026-10-20T12:00:00Z'),
    requiredSkills: ['photography'],
    priority: 'medium'
  };

  test('returns -Infinity if member explicitly marked unavailable', () => {
    const member = {
      _id: 'm1',
      seniority: '2nd_year',
      skills: ['photography'],
      availability: [{
        festId: 'fest1',
        date: new Date('2026-10-20'),
        isAvailable: false
      }]
    };

    const score = scoreMemberForEvent(member, baseEvent, venueMap, []);
    expect(score).toBe(-Infinity);
  });

  test('returns -Infinity if member has overlapping assignment', () => {
    const member = {
      _id: 'm1',
      seniority: '2nd_year',
      skills: ['photography'],
      availability: []
    };

    const todaysAssignments = [{
      memberId: 'm1',
      eventId: {
        startTime: new Date('2026-10-20T11:00:00Z'), // overlaps 10am-12pm
        endTime: new Date('2026-10-20T13:00:00Z'),
        venueId: 'v1'
      }
    }];

    const score = scoreMemberForEvent(member, baseEvent, venueMap, todaysAssignments);
    expect(score).toBe(-Infinity);
  });

  test('returns -Infinity if member cannot travel in time between venues', () => {
    const member = {
      _id: 'm1',
      seniority: '2nd_year',
      skills: ['photography']
    };

    // Prior event ends at 9:55am, 10 min travel buffer needed, but new event starts at 10:00am
    const todaysAssignments = [{
      memberId: 'm1',
      eventId: {
        startTime: new Date('2026-10-20T08:00:00Z'),
        endTime: new Date('2026-10-20T09:55:00Z'),
        venueId: 'v1'
      }
    }];

    const score = scoreMemberForEvent(member, baseEvent, venueMap, todaysAssignments);
    expect(score).toBe(-Infinity);
  });

  test('awards skill match bonus (+30) and applies workload penalty (-25)', () => {
    const member = {
      _id: 'm1',
      seniority: '2nd_year',
      skills: ['photography', 'videography'] // matches 'photography'
    };

    // Prior event ended at 8:00am (plenty of time)
    const todaysAssignments = [{
      memberId: 'm1',
      eventId: {
        startTime: new Date('2026-10-20T07:00:00Z'),
        endTime: new Date('2026-10-20T08:00:00Z'),
        venueId: 'v1'
      }
    }];

    // Base: 100 + 30 (skill match) - 25 (1 assignment today) = 105
    const score = scoreMemberForEvent(member, baseEvent, venueMap, todaysAssignments);
    expect(score).toBe(105);
  });

  test('awards critical event bonus (+40) to 3rd years', () => {
    const member = {
      _id: 'm_senior',
      seniority: '3rd_year',
      skills: ['photography']
    };

    const criticalEvent = {
      ...baseEvent,
      priority: 'critical'
    };

    // Base: 100 + 30 (skill) + 40 (critical senior) = 170
    const score = scoreMemberForEvent(member, criticalEvent, venueMap, []);
    expect(score).toBe(170);
  });

  test('returns -Infinity for 4th year members (strictly excluded from auto-matching)', () => {
    const member = {
      _id: 'm_4th',
      seniority: '4th_year',
      skills: ['photography']
    };

    const score = scoreMemberForEvent(member, baseEvent, venueMap, []);
    expect(score).toBe(-Infinity);
  });
});

describe('Seniority Allocation Rules & Team Selection', () => {
  const { isAllowedSeniorityPair, selectBestTeam } = require('../../src/services/assignmentEngine');

  test('validates allowed seniority pairs: 1st with 2nd, 2nd with 3rd, and 1st with 3rd', () => {
    // Allowed pairs
    expect(isAllowedSeniorityPair('1st_year', '2nd_year')).toBe(true);
    expect(isAllowedSeniorityPair('2nd_year', '1st_year')).toBe(true);
    expect(isAllowedSeniorityPair('2nd_year', '3rd_year')).toBe(true);
    expect(isAllowedSeniorityPair('3rd_year', '2nd_year')).toBe(true);
    expect(isAllowedSeniorityPair('1st_year', '3rd_year')).toBe(true);
    expect(isAllowedSeniorityPair('3rd_year', '1st_year')).toBe(true);

    // Disallowed pairs
    expect(isAllowedSeniorityPair('1st_year', '1st_year')).toBe(false);
    expect(isAllowedSeniorityPair('4th_year', '1st_year')).toBe(false);
    expect(isAllowedSeniorityPair('4th_year', '2nd_year')).toBe(false);
    expect(isAllowedSeniorityPair('4th_year', '3rd_year')).toBe(false);
  });

  test('selectBestTeam pairs 1st year with 2nd year instead of two 1st years with higher individual scores', () => {
    const scoredCandidates = [
      { member: { _id: 'j1', name: 'Junior 1', seniority: '1st_year' }, score: 160 },
      { member: { _id: 'j2', name: 'Junior 2', seniority: '1st_year' }, score: 150 },
      { member: { _id: 's2', name: 'Sophomore', seniority: '2nd_year' }, score: 140 },
      { member: { _id: 's3', name: 'Lead', seniority: '3rd_year' }, score: 130 }
    ];

    const team = selectBestTeam(scoredCandidates, 2);
    expect(team.length).toBe(2);

    const seniorities = team.map(m => m.seniority);
    // Must NOT pair two 1st years together!
    expect(seniorities).not.toEqual(['1st_year', '1st_year']);
    // Best valid pair is j1 (160) + s2 (140) = 300
    expect(seniorities).toContain('1st_year');
    expect(seniorities).toContain('2nd_year');
    expect(team.map(m => m._id)).toEqual(['j1', 's2']);
  });

  test('selectBestTeam supports 2nd year with 3rd year pairing', () => {
    const scoredCandidates = [
      { member: { _id: 's2', name: 'Sophomore', seniority: '2nd_year' }, score: 140 },
      { member: { _id: 's3', name: 'Senior Lead', seniority: '3rd_year' }, score: 135 }
    ];

    const team = selectBestTeam(scoredCandidates, 2);
    expect(team.length).toBe(2);
    const seniorities = team.map(m => m.seniority);
    expect(seniorities).toContain('2nd_year');
    expect(seniorities).toContain('3rd_year');
  });

  test('selectBestTeam supports 1st year with 3rd year pairing', () => {
    const scoredCandidates = [
      { member: { _id: 'j1', name: 'Junior 1', seniority: '1st_year' }, score: 155 },
      { member: { _id: 's3', name: 'Senior Lead', seniority: '3rd_year' }, score: 135 }
    ];

    const team = selectBestTeam(scoredCandidates, 2);
    expect(team.length).toBe(2);
    const seniorities = team.map(m => m.seniority);
    expect(seniorities).toContain('1st_year');
    expect(seniorities).toContain('3rd_year');
  });
});
