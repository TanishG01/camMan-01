import api from '../api';

export const festsApi = {
  getFests: (status) => api.get('/fests', { params: { status } }),
  getFestById: (festId) => api.get(`/fests/${festId}`),
  createFest: (data) => api.post('/fests', data),
  updateFest: (festId, data) => api.patch(`/fests/${festId}`, data),
  updateFestStatus: (festId, status) => api.patch(`/fests/${festId}/status`, { status }),
  deleteFest: (festId) => api.delete(`/fests/${festId}`),

  // Venues
  getVenues: (festId) => api.get(`/fests/${festId}/venues`),
  createVenue: (festId, data) => api.post(`/fests/${festId}/venues`, data),
  updateVenue: (festId, venueId, data) => api.patch(`/fests/${festId}/venues/${venueId}`, data),
};
