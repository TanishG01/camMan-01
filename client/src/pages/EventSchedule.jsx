import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsApi } from '../services/endpoints/events';
import { festsApi } from '../services/endpoints/fests';
import { assignmentsApi } from '../services/endpoints/assignments';
import { authApi } from '../services/endpoints/auth';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Clock, MapPin, Plus, FileSpreadsheet, AlertTriangle, ArrowLeft,
  Users, Sparkles, Check, X, ShieldAlert, UserPlus, CheckCircle2, Trash2,
  ChevronRight, LayoutGrid, Layers
} from 'lucide-react';

export default function EventSchedule() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSenior } = useAuth();

  const [fest, setFest] = useState(null);
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(`Are you sure you want to delete the event "${event.name}"?\n\nThis will also remove any team assignments for this event and return reserved equipment.`)) {
      return;
    }
    try {
      setError(null);
      await eventsApi.deleteEvent(festId, event._id);
      setActionSuccess(`Event "${event.name}" deleted successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err) {
      setError(`Failed to delete event: ${err.message}`);
    }
  };

  // Delay Modal State
  const [showDelayModal, setShowDelayModal] = useState(null);
  const [delayTime, setDelayTime] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [delaying, setDelaying] = useState(false);

  // Coverage Allocation Modal State
  const [coverageModalEvent, setCoverageModalEvent] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState('photographer');
  const [selectedMentorId, setSelectedMentorId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fRes, eRes, vRes, aRes, uRes] = await Promise.all([
        festsApi.getFestById(festId),
        eventsApi.getEvents(festId),
        festsApi.getVenues(festId),
        assignmentsApi.getAssignments({ festId }),
        authApi.getUsers({ isActive: true })
      ]);
      setFest(fRes.data.fest);
      setEvents(eRes.data.events || []);
      setVenues(vRes.data.venues || []);
      setAssignments(aRes.data.assignments || []);
      setTeamMembers(uRes.data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [festId]);

  // Group assignments by eventId
  const assignmentsByEvent = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      const eid = String(a.eventId?._id || a.eventId);
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid).push(a);
    });
    return map;
  }, [assignments]);

  // Compute fest days dynamically
  const festDays = useMemo(() => {
    const dateMap = new Map();

    const toDateKey = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (events && events.length > 0) {
      events.forEach(event => {
        const key = toDateKey(event.startTime) || toDateKey(event.date);
        if (key) {
          if (!dateMap.has(key)) {
            dateMap.set(key, {
              dateKey: key,
              dateObj: new Date(key + 'T00:00:00'),
              events: []
            });
          }
          dateMap.get(key).events.push(event);
        }
      });

      // Fill in-between gap days if duration <= 14 days
      const eventDateKeys = Array.from(dateMap.keys()).sort();
      if (eventDateKeys.length > 0) {
        const minDate = new Date(eventDateKeys[0] + 'T00:00:00');
        const maxDate = new Date(eventDateKeys[eventDateKeys.length - 1] + 'T00:00:00');
        const diffDays = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1 && diffDays <= 14) {
          const cur = new Date(minDate);
          while (cur <= maxDate) {
            const key = toDateKey(cur);
            if (key && !dateMap.has(key)) {
              dateMap.set(key, {
                dateKey: key,
                dateObj: new Date(cur),
                events: []
              });
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
      }
    } else if (fest?.startDate && fest?.endDate) {
      const start = new Date(fest.startDate);
      const end = new Date(fest.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const cur = new Date(start);
        let count = 0;
        while (cur <= end && count < 14) {
          const key = toDateKey(cur);
          if (key && !dateMap.has(key)) {
            dateMap.set(key, {
              dateKey: key,
              dateObj: new Date(cur),
              events: []
            });
          }
          cur.setDate(cur.getDate() + 1);
          count++;
        }
      }
    }

    const sortedDateKeys = Array.from(dateMap.keys()).sort();

    return sortedDateKeys.map((key, idx) => {
      const item = dateMap.get(key);
      const dayEvents = (item.events || []).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      let requiredCrew = 0;
      let allocatedCrew = 0;
      let delayedCount = 0;
      let criticalCount = 0;
      let hasMentorAlert = false;
      const venuesSet = new Set();
      const categoriesSet = new Set();

      dayEvents.forEach(e => {
        requiredCrew += (e.teamSizeRequired || 2);
        if (e.venueId?.name) venuesSet.add(e.venueId.name);
        if (e.category) categoriesSet.add(e.category);
        if (e.status === 'delayed') delayedCount++;
        if (e.priority === 'critical') criticalCount++;

        const eAssigns = assignmentsByEvent.get(String(e._id)) || [];
        const valid = eAssigns.filter(a => ['suggested', 'approved'].includes(a.status));
        allocatedCrew += valid.length;
        if (valid.some(a => a.isMentorNeeded)) hasMentorAlert = true;
      });

      const dObj = item.dateObj;
      const formattedDate = !isNaN(dObj.getTime())
        ? dObj.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        : key;

      const shortDate = !isNaN(dObj.getTime())
        ? dObj.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
          })
        : key;

      return {
        dayNumber: idx + 1,
        dateKey: key,
        dateObj: dObj,
        formattedDate,
        shortDate,
        events: dayEvents,
        eventCount: dayEvents.length,
        requiredCrew,
        allocatedCrew,
        delayedCount,
        criticalCount,
        hasMentorAlert,
        venues: Array.from(venuesSet),
        categories: Array.from(categoriesSet)
      };
    });
  }, [fest, events, assignmentsByEvent]);

  const currentDayParam = searchParams.get('day');
  const isMultiDay = festDays.length > 1;

  const activeDay = useMemo(() => {
    if (currentDayParam === 'all') return null;
    if (currentDayParam) {
      return festDays.find(d => String(d.dayNumber) === String(currentDayParam)) || festDays[0] || null;
    }
    return !isMultiDay && festDays.length === 1 ? festDays[0] : null;
  }, [currentDayParam, festDays, isMultiDay]);

  const isShowingDaysOverview = isMultiDay && !currentDayParam;

  const handleDelaySubmit = async (e) => {
    e.preventDefault();
    if (!showDelayModal || !delayTime) return;
    setDelaying(true);
    try {
      await eventsApi.delayEvent(festId, showDelayModal._id, {
        newEndTime: delayTime,
        reason: delayReason
      });
      setShowDelayModal(null);
      setDelayTime('');
      setDelayReason('');
      loadData();
    } catch (err) {
      alert(`Delay failed: ${err.message}`);
    } finally {
      setDelaying(false);
    }
  };

  const handleAutoSuggest = async (eventId) => {
    setSuggesting(true);
    setError(null);
    try {
      await assignmentsApi.suggestAssignments(eventId);
      setActionSuccess('Smart coverage suggestions generated based on skills, availability & travel buffers!');
      const aRes = await assignmentsApi.getAssignments({ festId });
      setAssignments(aRes.data.assignments || []);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(`Auto-suggest failed: ${err.message}`);
    } finally {
      setSuggesting(false);
    }
  };

  const handleManualAssign = async (e) => {
    e.preventDefault();
    if (!coverageModalEvent || !selectedMemberId) return;

    setAssigning(true);
    setError(null);
    try {
      await assignmentsApi.createAssignment({
        festId,
        eventId: coverageModalEvent._id,
        memberId: selectedMemberId,
        roleInEvent: selectedRole,
        mentorId: selectedMentorId || null
      });
      setSelectedMemberId('');
      setSelectedMentorId('');
      setActionSuccess('Team member allocated to event successfully!');
      const aRes = await assignmentsApi.getAssignments({ festId });
      setAssignments(aRes.data.assignments || []);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(`Assignment failed: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const handleApproveAssignment = async (assignmentId) => {
    try {
      await assignmentsApi.approveAssignment(assignmentId);
      const aRes = await assignmentsApi.getAssignments({ festId });
      setAssignments(aRes.data.assignments || []);
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to remove this coverage assignment?')) return;
    try {
      await assignmentsApi.deleteAssignment(assignmentId);
      const aRes = await assignmentsApi.getAssignments({ festId });
      setAssignments(aRes.data.assignments || []);
    } catch (err) {
      alert(`Removal failed: ${err.message}`);
    }
  };

  // Selected member object for dynamic mentorship options
  const selectedMemberObj = teamMembers.find(m => String(m._id) === String(selectedMemberId));

  // Eligible mentors based on allocation rules:
  // - 1st year can allocate with 2nd year or 3rd year
  // - 2nd year can allocate with 3rd year
  // - 4th year cannot be allocated to anyone
  const eligibleMentors = teamMembers.filter(m => {
    if (m.seniority === '4th_year') return false;
    if (String(m._id) === String(selectedMemberId)) return false;
    if (selectedMemberObj?.seniority === '1st_year') {
      return ['2nd_year', '3rd_year'].includes(m.seniority);
    }
    if (selectedMemberObj?.seniority === '2nd_year') {
      return m.seniority === '3rd_year';
    }
    return false;
  });

  const renderEventCard = (event) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const isDelayed = event.status === 'delayed';
    const isCancelled = event.status === 'cancelled';

    const eventAssignments = assignmentsByEvent.get(String(event._id)) || [];
    const validAssigned = eventAssignments.filter(a => ['suggested', 'approved'].includes(a.status));
    const requiredCount = event.teamSizeRequired || 2;
    const isFullyAllocated = validAssigned.length >= requiredCount;
    const hasMentorAlert = validAssigned.some(a => a.isMentorNeeded);

    return (
      <div
        key={event._id}
        className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isDelayed ? 'border-amber-300 bg-amber-50/20' : isCancelled ? 'border-rose-200 bg-rose-50/20 opacity-75' : 'border-slate-200'
        }`}
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              isDelayed ? 'bg-amber-100 text-amber-800' : isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
            }`}>
              {event.status}
            </span>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {event.category}
            </span>
            {event.priority === 'critical' && (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                Critical Priority
              </span>
            )}

            {/* Coverage Status Badge */}
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
              isFullyAllocated
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : validAssigned.length > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              <Users className="w-3 h-3" />
              {validAssigned.length}/{requiredCount} Crew Allocated
            </span>

            {hasMentorAlert && (
              <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Mentor Needed
              </span>
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-900">{event.name}</h3>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {start.toLocaleDateString()} • {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {event.venueId?.name || 'Venue TBA'}
            </span>
            <span>Deliverables: {event.requiredDeliverables?.join(', ') || 'Photos'}</span>
          </div>

          {/* Allocated Crew Tags */}
          {validAssigned.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Crew:</span>
              {validAssigned.map(a => {
                const mName = a.memberId?.name || 'Member';
                const isSuggested = a.status === 'suggested';
                return (
                  <span
                    key={a._id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                      isSuggested
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSuggested ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {mName}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({a.roleInEvent?.replace('_', ' ')})
                    </span>
                    {a.mentorId && (
                      <span className="text-[10px] text-indigo-600 font-medium">
                        • Mentored by {a.mentorId.name}
                      </span>
                    )}
                    {a.isMentorNeeded && (
                      <span className="text-[10px] text-rose-600 font-bold">
                        (Needs Senior)
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {isDelayed && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              ⚠ Delayed: {event.delayInfo?.reason || 'Revised coverage needed'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCoverageModalEvent(event)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm inline-flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Allocate Team
          </button>

          {!isCancelled && (
            <button
              onClick={() => {
                setShowDelayModal(event);
                setDelayTime(new Date(new Date(event.endTime).getTime() + 30 * 60000).toISOString());
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Delay
            </button>
          )}

          {isSenior && (
            <button
              title="Delete Event"
              onClick={() => handleDeleteEvent(event)}
              className="p-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        {isShowingDaysOverview ? (
          <button
            onClick={() => navigate('/fests')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Fests
          </button>
        ) : isMultiDay ? (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Days Overview
          </button>
        ) : (
          <button
            onClick={() => navigate('/fests')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Fests
          </button>
        )}

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {fest?.name || 'Fest Schedule'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isShowingDaysOverview
                ? `${festDays.length} Festival Days • ${events.length} Events Registered • ${teamMembers.length} Team Members Available`
                : currentDayParam === 'all'
                ? `Full Schedule • Showing all ${events.length} events across ${festDays.length} days`
                : activeDay
                ? `Day ${activeDay.dayNumber}: ${activeDay.formattedDate} • ${activeDay.eventCount} events`
                : `Live schedule & coverage allocation • ${events.length} events registered`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isShowingDaysOverview && (
              <button
                onClick={() => setSearchParams({ day: 'all' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm transition-colors"
              >
                <Layers className="w-4 h-4 text-slate-500" />
                View All Events Combined
              </button>
            )}

            <button
              onClick={() => navigate('/team')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm transition-colors"
            >
              <Users className="w-4 h-4 text-indigo-600" />
              Manage Team Roster
            </button>

            {isSenior && (
              <button
                onClick={() => navigate(`/fests/${festId}/import`)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Import Excel
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionSuccess}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Events Scheduled</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              Import a spreadsheet or manually create events to populate the coverage timeline.
            </p>
            {isSenior && (
              <button
                onClick={() => navigate(`/fests/${festId}/import`)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
              >
                Import Excel Schedule
              </button>
            )}
          </div>
        ) : isShowingDaysOverview ? (
          /* ======================================================== */
          /* 1. DAYS OVERVIEW PAGE (when festival spans multiple days)  */
          /* ======================================================== */
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Festival Days</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a day to view its specific schedule and manage photography coverage
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {festDays.length} Days Configured
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {festDays.map(day => (
                <div
                  key={day.dayNumber}
                  onClick={() => setSearchParams({ day: day.dayNumber })}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Day {day.dayNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors inline-flex items-center gap-1">
                        View Schedule <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {day.formattedDate}
                    </h3>

                    {/* Event count & categories */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                        {day.eventCount} {day.eventCount === 1 ? 'Event' : 'Events'}
                      </span>
                      {day.categories.slice(0, 3).map(cat => (
                        <span key={cat} className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50/70 text-indigo-700">
                          {cat}
                        </span>
                      ))}
                      {day.categories.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{day.categories.length - 3} more</span>
                      )}
                    </div>

                    {/* Venues */}
                    {day.venues.length > 0 && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{day.venues.join(' • ')}</span>
                      </div>
                    )}

                    {/* Status flags */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {day.delayedCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                          ⚠ {day.delayedCount} Delayed
                        </span>
                      )}
                      {day.criticalCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          ★ {day.criticalCount} Critical
                        </span>
                      )}
                      {day.hasMentorAlert && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Mentor Alert
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Crew Allocation Progress */}
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Coverage Crew
                      </span>
                      <span className={day.allocatedCrew >= day.requiredCrew && day.requiredCrew > 0 ? 'text-emerald-600' : 'text-slate-700'}>
                        {day.allocatedCrew}/{day.requiredCrew} Allocated
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          day.allocatedCrew >= day.requiredCrew && day.requiredCrew > 0
                            ? 'bg-emerald-500'
                            : day.allocatedCrew > 0
                            ? 'bg-amber-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${day.requiredCrew > 0 ? Math.min(100, Math.round((day.allocatedCrew / day.requiredCrew) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* 2. PARTICULAR DAY SCHEDULE PAGE                          */
          /* ======================================================== */
          <div>
            {/* Day Selector Pill Tabs */}
            {isMultiDay && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl mb-6">
                <button
                  onClick={() => setSearchParams({})}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-colors flex items-center gap-1.5"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Days Overview
                </button>
                {festDays.map(d => {
                  const isActive = String(d.dayNumber) === String(currentDayParam);
                  return (
                    <button
                      key={d.dayNumber}
                      onClick={() => setSearchParams({ day: d.dayNumber })}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-white/80'
                      }`}
                    >
                      <span>Day {d.dayNumber}</span>
                      <span className={`text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                        ({d.shortDate})
                      </span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {d.eventCount}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setSearchParams({ day: 'all' })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    currentDayParam === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/80'
                  }`}
                >
                  All Days Combined
                </button>
              </div>
            )}

            {/* Day Title Banner */}
            {activeDay && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Day {activeDay.dayNumber} {isMultiDay ? `of ${festDays.length}` : ''}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {activeDay.formattedDate}
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Day {activeDay.dayNumber} Event Schedule
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeDay.eventCount} events scheduled • {activeDay.allocatedCrew}/{activeDay.requiredCrew} crew allocated • {activeDay.venues.length} venues active
                  </p>
                </div>

                {isMultiDay && (
                  <button
                    onClick={() => setSearchParams({})}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> All Days
                  </button>
                )}
              </div>
            )}

            {/* Events Content */}
            {currentDayParam === 'all' ? (
              <div className="space-y-8">
                {festDays.map(d => (
                  <div key={d.dayNumber} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          Day {d.dayNumber}
                        </span>
                        <h3 className="text-sm font-bold text-slate-800">{d.formattedDate}</h3>
                        <span className="text-xs text-slate-400">({d.eventCount} events)</span>
                      </div>
                      <button
                        onClick={() => setSearchParams({ day: d.dayNumber })}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Focus Day {d.dayNumber} →
                      </button>
                    </div>
                    {d.events.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No events scheduled for this day.</p>
                    ) : (
                      <div className="space-y-4">
                        {d.events.map(event => renderEventCard(event))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : activeDay ? (
              activeDay.events.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No Events Scheduled for Day {activeDay.dayNumber}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
                    There are currently no events scheduled on {activeDay.formattedDate}.
                  </p>
                  {isSenior && (
                    <button
                      onClick={() => navigate(`/fests/${festId}/import`)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-sm"
                    >
                      Import Excel Schedule
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {activeDay.events.map(event => renderEventCard(event))}
                </div>
              )
            ) : null}
          </div>
        )}

        {/* Coverage Allocation Modal */}
        {coverageModalEvent && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Allocate Coverage: {coverageModalEvent.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target: {coverageModalEvent.teamSizeRequired} crew members • Venue: {coverageModalEvent.venueId?.name || 'TBA'}
                  </p>
                </div>
                <button
                  onClick={() => setCoverageModalEvent(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 mb-6">
                <div>
                  <p className="text-xs font-bold text-indigo-950">Auto-Matching Engine</p>
                  <p className="text-[11px] text-indigo-700">
                    Considers member skills, availability slots, travel buffers & mentorship pairing.
                  </p>
                </div>
                <button
                  onClick={() => handleAutoSuggest(coverageModalEvent._id)}
                  disabled={suggesting}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {suggesting ? 'Calculating Best Match...' : 'Auto-Suggest Coverage'}
                </button>
              </div>

              {/* Current Assignments List */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Currently Allocated Crew ({(assignmentsByEvent.get(String(coverageModalEvent._id)) || []).length}/{coverageModalEvent.teamSizeRequired})
                </h4>

                {(assignmentsByEvent.get(String(coverageModalEvent._id)) || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                    No members allocated yet. Click "Auto-Suggest Coverage" above or add team members manually below.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {(assignmentsByEvent.get(String(coverageModalEvent._id)) || []).map(a => {
                      const isSuggested = a.status === 'suggested';
                      const member = a.memberId || {};
                      return (
                        <div key={a._id} className="p-3 bg-white flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{member.name || 'Member'}</span>
                              <span className="text-[10px] font-mono text-slate-400">{member.email}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                                {member.seniority?.replace('_', ' ')}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                isSuggested ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {a.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                              <span>Role: <strong className="capitalize">{a.roleInEvent?.replace('_', ' ')}</strong></span>
                              {a.mentorId && (
                                <span className="text-indigo-600">
                                  • Senior Mentor: <strong>{a.mentorId.name}</strong>
                                </span>
                              )}
                              {a.isMentorNeeded && (
                                <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                                  <ShieldAlert className="w-3 h-3" /> Senior mentor needed for 1st-year
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isSuggested && (
                              <button
                                onClick={() => handleApproveAssignment(a._id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveAssignment(a._id)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 font-semibold text-[11px]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Direct Add Member Form */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Direct Allocate Member
                </h4>

                <form onSubmit={handleManualAssign} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Select Member</label>
                      <select
                        required
                        value={selectedMemberId}
                        onChange={e => setSelectedMemberId(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-xl text-xs bg-white"
                      >
                        <option value="">-- Choose Member --</option>
                        {teamMembers.map(m => (
                          <option key={m._id} value={m._id}>
                            {m.name} ({m.seniority?.replace('_', ' ')} • {m.skills?.join(', ') || 'No skills'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Coverage Role</label>
                      <select
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-xl text-xs bg-white"
                      >
                        <option value="lead_photographer">Lead Photographer</option>
                        <option value="photographer">Photographer</option>
                        <option value="videographer">Videographer</option>
                        <option value="shadow_trainee">Shadow Trainee (Junior)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Mentor (Optional)
                      </label>
                      <select
                        value={selectedMentorId}
                        onChange={e => setSelectedMentorId(e.target.value)}
                        disabled={selectedMemberObj?.seniority === '3rd_year' || selectedMemberObj?.seniority === '4th_year'}
                        className="w-full px-2.5 py-2 border rounded-xl text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {selectedMemberObj?.seniority === '3rd_year' ? (
                          <option value="">-- Senior Lead (No Mentor Needed) --</option>
                        ) : selectedMemberObj?.seniority === '1st_year' ? (
                          <>
                            <option value="">-- Choose 2nd or 3rd Year Mentor --</option>
                            {eligibleMentors.map(m => (
                              <option key={m._id} value={m._id}>
                                {m.name} ({m.seniority?.replace('_', ' ')})
                              </option>
                            ))}
                          </>
                        ) : selectedMemberObj?.seniority === '2nd_year' ? (
                          <>
                            <option value="">-- Optional: 3rd Year Lead Mentor --</option>
                            {eligibleMentors.map(m => (
                              <option key={m._id} value={m._id}>
                                {m.name} ({m.seniority?.replace('_', ' ')})
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="">-- Select Member First --</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={assigning || !selectedMemberId}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {assigning ? 'Allocating...' : 'Assign to Event'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delay Modal */}
        {showDelayModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Report Event Delay</h2>
              <p className="text-xs text-slate-500 mb-4">
                Reporting delay for <strong>"{showDelayModal.name}"</strong>. The system will detect conflicts with members' next assignments.
              </p>

              <form onSubmit={handleDelaySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">New Estimated End Time (ISO)</label>
                  <input
                    type="text"
                    required
                    value={delayTime}
                    onChange={e => setDelayTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason for Delay</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Stage power failure, artist running late..."
                    value={delayReason}
                    onChange={e => setDelayReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDelayModal(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={delaying}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {delaying ? 'Recording...' : 'Confirm Delay'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
