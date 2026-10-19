import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignmentsApi } from '../services/endpoints/assignments';
import { authApi } from '../services/endpoints/auth';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, UserCheck, ArrowLeft, CheckCircle2, UserX } from 'lucide-react';

export default function MentorshipMonitor() {
  const navigate = useNavigate();
  const { isSenior } = useAuth();

  const [gapAssignments, setGapAssignments] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignRes, usersRes] = await Promise.all([
        assignmentsApi.getAssignments({ isMentorNeeded: true }),
        authApi.getUsers()
      ]);
      setGapAssignments(assignRes.data.assignments || []);
      const seniorList = (usersRes.data.users || []).filter(u =>
        ['2nd_year', '3rd_year'].includes(u.seniority)
      );
      setSeniors(seniorList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignMentor = async (e) => {
    e.preventDefault();
    if (!assigningId || !selectedMentor) return;

    setSubmitting(true);
    try {
      await assignmentsApi.assignMentor(assigningId, selectedMentor);
      setAssigningId(null);
      setSelectedMentor('');
      loadData();
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" /> Mentorship Enforcement Engine (Case 2)
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mentorship & Coverage Gaps</h1>
          <p className="text-slate-500 text-sm mt-1">
            Every 1st-year member covering an event must be paired with an experienced 2nd or 3rd year senior mentor.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : gapAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">All Juniors Are Mentored</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are currently 0 unassigned 1st-year members in the field. All mentorship constraints are satisfied.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {gapAssignments.map(assign => (
              <div
                key={assign._id}
                className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                      <UserX className="w-3.5 h-3.5" /> Mentor Needed
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Event: <strong className="text-slate-900">{assign.eventId?.name}</strong>
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">
                    {assign.memberId?.name} ({assign.memberId?.seniority?.replace('_', ' ')})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Role in event: <span className="capitalize font-medium">{assign.roleInEvent?.replace('_', ' ')}</span> • Email: {assign.memberId?.email}
                  </p>
                </div>

                {isSenior && (
                  <button
                    onClick={() => {
                      setAssigningId(assign._id);
                      setSelectedMentor('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                    Assign Mentor
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal to Assign Mentor */}
        {assigningId && (() => {
          const targetAssign = gapAssignments.find(a => a._id === assigningId);
          const eligibleSeniors = seniors.filter(s => {
            if (targetAssign?.memberId?.seniority === '2nd_year') return s.seniority === '3rd_year';
            return true;
          });

          return (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Assign Senior Mentor</h2>
                <p className="text-xs text-slate-500 mb-4">
                  {targetAssign?.memberId?.seniority === '2nd_year'
                    ? 'Select a 3rd-year lead photographer to guide this 2nd-year member.'
                    : 'Select an experienced 2nd or 3rd year member to guide and shadow this freshman.'}
                </p>

                <form onSubmit={handleAssignMentor} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Available Mentors</label>
                    <select
                      required
                      value={selectedMentor}
                      onChange={e => setSelectedMentor(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="">-- Choose Mentor / Lead --</option>
                      {eligibleSeniors.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.seniority?.replace('_', ' ')}) • {s.skills?.join(', ')}
                        </option>
                      ))}
                    </select>
                  </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningId(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedMentor}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? 'Confirming...' : 'Confirm Mentorship'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}
