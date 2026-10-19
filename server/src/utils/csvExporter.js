/**
 * Converts array of AuditLog documents into a standard RFC-4180 CSV string
 */
const exportAuditLogsToCsv = (logs) => {
  const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Entity Type', 'Entity ID', 'Reason', 'IP Address'];
  
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map(log => [
    escapeCsv(new Date(log.timestamp).toISOString()),
    escapeCsv(log.actorId?.name || 'System'),
    escapeCsv(log.actorId?.email || ''),
    escapeCsv(log.action),
    escapeCsv(log.targetEntity?.entityType || ''),
    escapeCsv(log.targetEntity?.entityId || ''),
    escapeCsv(log.reason || ''),
    escapeCsv(log.ipAddress || '')
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

module.exports = {
  exportAuditLogsToCsv
};
