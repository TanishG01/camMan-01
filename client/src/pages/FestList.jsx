import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { festsApi } from '../services/endpoints/fests';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Plus, ChevronRight, MapPin, Film, Sparkles, Trash2 } from 'lucide-react';

export default function FestList() {
  const [fests, setFests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { isAdmin, isSenior } = useAuth();
  const navigate = useNavigate();

  const loadFests = async () => {
    try {
      setLoading(true);
      const res = await festsApi.getFests();
      setFests(res.data.fests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFest = async (fest) => {
    if (!window.confirm(`Are you sure you want to delete "${fest.name}"?\n\nThis will permanently delete this fest and all its associated events, venues, assignments, and coverage records.`)) {
      return;
    }
    try {
      setError(null);
      await festsApi.deleteFest(fest._id);
      loadFests();
    } catch (err) {
      setError(`Failed to delete fest: ${err.message}`);
    }
  };

  useEffect(() => {
    loadFests();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await festsApi.createFest(formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '', startDate: '', endDate: '' });
      loadFests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 inline-flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Fests & Editions</h1>
            <p className="text-slate-500 text-sm mt-1">Manage festivals, editions, venues, and overall festival schedules</p>
          </div>

          {isSenior && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Fest
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : fests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Fests Registered Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your college fest edition to start importing schedules and organizing photography assignments.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fests.map(fest => (
              <div
                key={fest._id}
                onClick={() => navigate(`/fests/${fest._id}/events`)}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {fest.status}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSenior && (
                        <button
                          type="button"
                          title="Delete Fest"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFest(fest);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{fest.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{fest.description || 'No description provided.'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{fest.venueCount || 0} Venues</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-slate-400" />
                    <span>{fest.eventCount || 0} Events</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Fest Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Fest</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fest Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oasis 2026"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Cultural fest description..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Fest'}
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
