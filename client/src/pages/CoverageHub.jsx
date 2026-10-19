import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { coverageApi } from '../services/endpoints/coverage';
import { festsApi } from '../services/endpoints/fests';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';

export default function CoverageHub() {
  const navigate = useNavigate();
  const { user, isSenior } = useAuth();

  const [records, setRecords] = useState([]);
  const [fests, setFests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUnplannedModal, setShowUnplannedModal] = useState(false);
  const [formData, setFormData] = useState({
    festId: '',
    eventName: '',
    venueName: '',
    durationMinutes: 30,
    deliverables: 'photos',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [covRes, festRes] = await Promise.all([
        coverageApi.getCoverage(),
        festsApi.getFests()
      ]);
      setRecords(covRes.data.coverage || []);
      const festList = festRes.data.fests || [];
      setFests(festList);
      if (festList.length > 0 && !formData.festId) {
        setFormData(prev => ({ ...prev, festId: festList[0]._id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUnplannedSubmit = async (e) => {
    e.preventDefault();
    if (!formData.festId || !formData.eventName) return;

    setSubmitting(true);
    setError(null);
    try {
      await coverageApi.reportUnplanned({
        festId: formData.festId,
        unplannedDetails: {
          eventName: formData.eventName,
          venueName: formData.venueName || 'Campus Venue',
          eventDate: new Date()
        },
        actualContributors: [
          { memberId: user._id, roleInEvent: 'photographer', contributionNotes: formData.notes }
        ],
        actualDurationMinutes: Number(formData.durationMinutes),
        deliverablesProduced: [formData.deliverables],
        notes: formData.notes
      });
      setShowUnplannedModal(false);
      setFormData({ festId: fests[0]?._id || '', eventName: '', venueName: '', durationMinutes: 30, deliverables: 'photos', notes: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id, status) => {
    try {
      await coverageApi.validateCoverage(id, { validationStatus: status });
      loadData();
    } catch (err) {
      alert(`Validation failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Coverage & Extra Events Hub</h1>
            <p className="text-slate-500 text-sm mt-1">
              Field reports • Multi-contributor work history • Unplanned surprise coverage (Case 7)
            </p>
          </div>

          <button
            onClick={() => setShowUnplannedModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm"
          >
            <Sparkles className="w-4 h-4" /> Report Unplanned Event
          </button>
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
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Coverage Reports Submitted</h3>
            <p className="text-xs text-slate-500 mt-1">Submitted coverage and extra-event logs will appear here for verification.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(rec => {
              const isUnplanned = rec.isUnplanned;
              const isPending = rec.validationStatus === 'pending_review';
              const isApproved = rec.validationStatus === 'approved';

              return (
                <div key={rec._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' : isPending ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rec.validationStatus.replace('_', ' ')}
                      </span>
                      {isUnplanned && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          Unplanned Extra Event
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">
                      {isUnplanned ? rec.unplannedDetails?.eventName : rec.eventId?.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                      <span>Venue: {isUnplanned ? rec.unplannedDetails?.venueName : rec.eventId?.venueId}</span>
                      <span>Duration: {rec.actualDurationMinutes} mins</span>
                      <span>Reporter: {rec.reportedBy?.name}</span>
                    </div>

                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Credited Contributors: {rec.actualContributors?.map(c => c.memberId?.name).join(', ') || 'None'}
                    </div>
                  </div>

                  {isSenior && isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleValidate(rec._id, 'approved')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                      >
                        Approve & Credit Work
                      </button>
                      <button
                        onClick={() => handleValidate(rec._id, 'rejected')}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unplanned Coverage Modal */}
        {showUnplannedModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Report Unplanned Event Coverage</h2>
              <p className="text-xs text-slate-500 mb-4">
                Did you cover an impromptu performance, flash mob, or unscheduled ceremony? Submit it here to receive verified work credit.
              </p>

              <form onSubmit={handleUnplannedSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select Fest</label>
                  <select
                    value={formData.festId}
                    onChange={e => setFormData({ ...formData, festId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    {fests.map(f => (
                      <option key={f._id} value={f._id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Event / Happening Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flash Mob at Library Lawn"
                    value={formData.eventName}
                    onChange={e => setFormData({ ...formData, eventName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Venue / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Library Lawn"
                      value={formData.venueName}
                      onChange={e => setFormData({ ...formData, venueName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={e => setFormData({ ...formData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Coverage Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Describe what was captured..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowUnplannedModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Extra Report'}
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
