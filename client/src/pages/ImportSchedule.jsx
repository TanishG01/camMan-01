import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../services/endpoints/events';
import ImportPreviewTable from '../components/events/ImportPreviewTable';
import { UploadCloud, FileSpreadsheet, ArrowLeft, Check } from 'lucide-react';

export default function ImportSchedule() {
  const { festId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleUploadPreview = async (e) => {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await eventsApi.importPreview(festId, formData);
      setPreview(res.data);
      // Auto-select valid and warning rows
      const validIndexes = res.data.rows
        .filter(r => r.status !== 'error')
        .map(r => r.rowIndex);
      setSelectedRows(validIndexes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRow = (index) => {
    setSelectedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (!preview) return;
    const importable = preview.rows.filter(r => r.status !== 'error').map(r => r.rowIndex);
    if (selectedRows.length === importable.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(importable);
    }
  };

  const handleCommit = async () => {
    if (!preview || selectedRows.length === 0) return;
    setError(null);
    setCommitting(true);
    try {
      const res = await eventsApi.importCommit(festId, {
        previewToken: preview.previewToken,
        rowIndexes: selectedRows
      });
      setSuccessMsg(`Successfully imported ${res.data.importedCount} events into fest schedule!`);
      setTimeout(() => {
        navigate(`/fests/${festId}/events`);
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(`/fests/${festId}/events`)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Schedule
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Import Schedule (.xlsx)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload your master fest Excel spreadsheet to preview, validate, and import all events at once.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {/* Upload Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mb-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="inline-flex p-4 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Choose Excel File</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Expected columns: <code>Event Name, Category, Date, Start Time, End Time, Venue</code>
            </p>

            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />

            {file && (
              <button
                onClick={handleUploadPreview}
                disabled={loading}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Analyzing Sheet...' : 'Generate Validation Preview'}
              </button>
            )}
          </div>
        </div>

        {/* Preview Table & Commit Action */}
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Validation Preview</h2>
              <button
                onClick={handleCommit}
                disabled={committing || selectedRows.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                {committing ? 'Committing...' : `Commit ${selectedRows.length} Events`}
              </button>
            </div>

            <ImportPreviewTable
              preview={preview}
              selectedRows={selectedRows}
              onToggleRow={handleToggleRow}
              onSelectAll={handleSelectAll}
            />
          </div>
        )}
      </div>
    </div>
  );
}
