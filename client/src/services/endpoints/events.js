import api from '../api';

export const eventsApi = {
  getEvents: (festId, params) => api.get(`/fests/${festId}/events`, { params }),
  getEventById: (festId, eventId) => api.get(`/fests/${festId}/events/${eventId}`),
  createEvent: (festId, data) => api.post(`/fests/${festId}/events`, data),
  updateEvent: (festId, eventId, data) => api.patch(`/fests/${festId}/events/${eventId}`, data),
  deleteEvent: (festId, eventId) => api.delete(`/fests/${festId}/events/${eventId}`),
  delayEvent: (festId, eventId, data) => api.post(`/fests/${festId}/events/${eventId}/delay`, data),
  cancelEvent: (festId, eventId, data) => api.post(`/fests/${festId}/events/${eventId}/cancel`, data),

  importPreview: (festId, formData) => api.post(`/fests/${festId}/events/import/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  importCommit: (festId, data) => api.post(`/fests/${festId}/events/import/commit`, data)
};
