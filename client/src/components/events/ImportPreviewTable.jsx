import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ImportPreviewTable({ preview, selectedRows, onToggleRow, onSelectAll }) {
  if (!preview || !preview.rows || preview.rows.length === 0) return null;

  const allImportableSelected = preview.rows
    .filter(r => r.status !== 'error')
    .every(r => selectedRows.includes(r.rowIndex));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Summary Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">
            Total Parsed: {preview.totalRows}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {preview.validCount} Valid
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {preview.warningCount} Warnings
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {preview.errorCount} Errors
          </span>
        </div>

        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {allImportableSelected ? 'Deselect All' : 'Select All Valid/Warnings'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">Import</th>
              <th className="py-2.5 px-3">Row</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Event Name</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Venue</th>
              <th className="py-2.5 px-3">Issues / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => {
              const isSelected = selectedRows.includes(row.rowIndex);
              const isError = row.status === 'error';
              const isWarning = row.status === 'warning';

              return (
                <tr
                  key={row.rowIndex}
                  className={`transition-colors ${
                    isError
                      ? 'bg-rose-50/40 text-rose-950'
                      : isWarning
                      ? 'bg-amber-50/30 text-amber-950'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      disabled={isError}
                      checked={isSelected}
                      onChange={() => onToggleRow(row.rowIndex)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 font-semibold">{row.rowNumber}</td>
                  <td className="py-2.5 px-3">
                    {isError ? (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </span>
                    ) : isWarning ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-semibold">{row.name || '—'}</td>
                  <td className="py-2.5 px-3">{row.category}</td>
                  <td className="py-2.5 px-3 font-mono">{row.date}</td>
                  <td className="py-2.5 px-3 font-mono">{row.startTime} - {row.endTime}</td>
                  <td className="py-2.5 px-3">{row.venueName}</td>
                  <td className="py-2.5 px-3">
                    {row.errors.map((err, i) => (
                      <div key={i} className="text-rose-600 font-medium">✗ {err}</div>
                    ))}
                    {row.warnings.map((warn, i) => (
                      <div key={i} className="text-amber-600 font-medium">⚠ {warn}</div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
