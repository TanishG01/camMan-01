import api from '../api';

export const auditApi = {
  getAuditLogs: (params) => api.get('/audit', { params }),
  exportCsvUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    return `${base}/audit/export?${query}`;
  }
};
