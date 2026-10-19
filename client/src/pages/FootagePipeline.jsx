import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { footageApi } from '../services/endpoints/footage';
import { useAuth } from '../contexts/AuthContext';
import { HardDrive, ArrowLeft, ShieldAlert, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react';

export default function FootagePipeline() {
  const navigate = useNavigate();
  const { user, isSenior } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [flagIssueItem, setFlagIssueItem] = useState(null);
  const [issueType, setIssueType] = useState('corruption');
  const [issueDescription, setIssueDescription] = useState('');
  const [flagging, setFlagging] = useState(false);

  const [backupItem, setBackupItem] = useState(null);
  const [backupLocation, setBackupLocation] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  const loadFootage = async () => {
    try {
      setLoading(true);
      const res = await footageApi.getFootage();
      setRecords(res.data.footage || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFootage();
  }, []);

  const handleConfirmHandover = async (id) => {
    try {
      await footageApi.confirmHandover(id, { acceptedById: user._id });
      loadFootage();
    } catch (err) {
      alert(`Handover failed: ${err.message}`);
    }
  };

  const handleUpdateBackup = async (e) => {
    e.preventDefault();
    if (!backupItem || !backupLocation) return;
    setBackingUp(true);
    try {
      await footageApi.updateBackup(backupItem._id, {
        backupStatus: 'backed_up',
        backupLocation
      });
      setBackupItem(null);
      setBackupLocation('');
      loadFootage();
    } catch (err) {
      alert(`Backup update failed: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleFlagIssue = async (e) => {
    e.preventDefault();
    if (!flagIssueItem || !issueDescription) return;
    setFlagging(true);
    try {
      await footageApi.flagIssue(flagIssueItem._id, {
        issueType,
        description: issueDescription
      });
      setFlagIssueItem(null);
      setIssueDescription('');
      loadFootage();
    } catch (err) {
      alert(`Issue flag failed: ${err.message}`);
    } finally {
      setFlagging(false);
    }
  };

  const handleVerify = async (id) => {
    try {
      await footageApi.verifyFootage(id);
      loadFootage();
    } catch (err) {
      alert(`Verification blocked: ${err.message}`);
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

        <div className="mb-6">
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            Media Asset Integrity & Verification (Case 6)
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Footage Handover & Backup Pipeline</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track physical SD cards from photographer pockets → handover → storage drives → sanity verification.
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
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <HardDrive className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Footage in Pipeline</h3>
            <p className="text-xs text-slate-500 mt-1">Coverage reports with SD card usage will register cards in this pipeline.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(item => {
              const hasOpenIssues = item.issues?.some(i => !i.isResolved);
              const isVerified = item.verificationStatus === 'verified';
              const isBackedUp = item.backupStatus === 'backed_up';
              const isHandedOver = item.handoverStatus === 'handed_over';

              return (
                <div key={item._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border">
                        {item.sdCardId?.equipmentId}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isVerified ? 'bg-emerald-100 text-emerald-800' : hasOpenIssues ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.verificationStatus.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Backup: {item.backupStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      Custodian: {item.currentCustodianId?.name} ({item.currentCustodianId?.phone || 'No phone'})
                    </h3>

                    {item.backupLocation && (
                      <p className="text-xs font-mono text-slate-500 mt-1">
                        Drive Path: {item.backupLocation}
                      </p>
                    )}

                    {hasOpenIssues && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Issue reported: {item.issues[0]?.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isHandedOver && isSenior && (
                      <button
                        onClick={() => handleConfirmHandover(item._id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                      >
                        Confirm Receipt
                      </button>
                    )}

                    {isHandedOver && !isBackedUp && isSenior && (
                      <button
                        onClick={() => setBackupItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
                      >
                        Log Backup Location
                      </button>
                    )}

                    {!isVerified && isSenior && (
                      <button
                        onClick={() => handleVerify(item._id)}
                        disabled={hasOpenIssues}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs disabled:opacity-40"
                      >
                        Verify Quality
                      </button>
                    )}

                    <button
                      onClick={() => setFlagIssueItem(item)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs"
                    >
                      Flag Issue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Backup Modal */}
        {backupItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Record Backup Location</h2>
              <form onSubmit={handleUpdateBackup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Backup Drive / Folder Path</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Drive 01 / Oasis2026 / Day 1 / RockShow"
                    value={backupLocation}
                    onChange={e => setBackupLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setBackupItem(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={backingUp}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg"
                  >
                    {backingUp ? 'Saving...' : 'Confirm Backup'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Flag Issue Modal */}
        {flagIssueItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Flag Footage / SD Issue (Case 6)</h2>
              <form onSubmit={handleFlagIssue} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Issue Type</label>
                  <select
                    value={issueType}
                    onChange={e => setIssueType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="corruption">SD Card Corruption / Unreadable</option>
                    <option value="missing_files">Missing Clips / Shots</option>
                    <option value="backup_failure">Drive Transfer Failed</option>
                    <option value="physical_damage">Card Physically Bent/Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Details about the corruption or failure..."
                    value={issueDescription}
                    onChange={e => setIssueDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setFlagIssueItem(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={flagging}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg"
                  >
                    {flagging ? 'Flagging...' : 'Lock & Flag Issue'}
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
