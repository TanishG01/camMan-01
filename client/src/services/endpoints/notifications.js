import api from '../api';

export const notificationsApi = {
  getMyNotifications: (unreadOnly = false) => api.get('/notifications', { params: { unreadOnly } }),
  markAsRead: (id) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all')
};
