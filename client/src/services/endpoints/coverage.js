import api from '../api';

export const coverageApi = {
  getCoverage: (params) => api.get('/coverage', { params }),
  reportCoverage: (data) => api.post('/coverage/report', data),
  reportUnplanned: (data) => api.post('/coverage/unplanned', data),
  validateCoverage: (id, data) => api.post(`/coverage/${id}/validate`, data)
};
