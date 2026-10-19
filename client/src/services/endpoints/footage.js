import api from '../api';

export const footageApi = {
  getFootage: (params) => api.get('/footage', { params }),
  initiateHandover: (id, data) => api.post(`/footage/${id}/initiate-handover`, data),
  confirmHandover: (id, data) => api.post(`/footage/${id}/confirm-handover`, data),
  updateBackup: (id, data) => api.patch(`/footage/${id}/backup`, data),
  flagIssue: (id, data) => api.post(`/footage/${id}/flag-issue`, data),
  resolveIssue: (id, issueIndex, data) => api.post(`/footage/${id}/resolve-issue/${issueIndex}`, data),
  verifyFootage: (id) => api.post(`/footage/${id}/verify`)
};
