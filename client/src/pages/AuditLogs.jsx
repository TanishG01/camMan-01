import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditApi } from '../services/endpoints/audit';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Download, ShieldCheck, Search, Filter } from 'lucide-react';

export default function AuditLogs() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [error, setError] = useState(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterAction) params.action = filterAction;
      const res = await auditApi.getAuditLogs(params);
      setLogs(res.data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filterAction]);

  const handleExportCsv = () => {
    const url = auditApi.exportCsvUrl(filterAction ? { action: filterAction } : {});
    window.open(url, '_blank');
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
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              Immutable System Audit Trail
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit Logs & History</h1>
            <p className="text-slate-500 text-sm mt-1">
              Cryptographic tamper-evident operational history • Reassignments, overrides, checkouts, and cancellations
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export Audit to CSV
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-6 flex items-center gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filter Action</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="">All Actions</option>
              <option value="USER_ROLE_CHANGED">User Role Changed</option>
              <option value="EVENT_CREATED">Event Created</option>
              <option value="EVENT_DELAYED">Event Delayed</option>
              <option value="EVENT_CANCELLED">Event Cancelled</option>
              <option value="EVENTS_IMPORTED">Events Imported</option>
              <option value="ASSIGNMENT_APPROVED">Assignment Approved</option>
              <option value="ASSIGNMENT_REASSIGNED">Assignment Reassigned</option>
              <option value="EQUIPMENT_ALLOCATED">Equipment Allocated</option>
              <option value="EQUIPMENT_CHECKED_OUT">Equipment Checked Out</option>
              <option value="EQUIPMENT_RETURNED">Equipment Returned</option>
              <option value="SD_HANDOVER_CONFIRMED">SD Handover Confirmed</option>
              <option value="FOOTAGE_VERIFIED">Footage Verified</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Audit Records Found</h3>
            <p className="text-xs text-slate-500 mt-1">Actions performed across the application will be permanently recorded here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Reason / Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{log.actorId?.name || 'System'}</p>
                      <p className="text-[10px] text-slate-400">{log.actorId?.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {log.targetEntity?.entityType}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {log.reason || JSON.stringify(log.changes) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
