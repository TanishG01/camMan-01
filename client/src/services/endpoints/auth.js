import api from '../api';

export const authApi = {
  login: (idToken, extra = {}) => api.post('/auth/login', { idToken, ...extra }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
  logout: () => api.post('/auth/logout'),
  createUser: (data) => api.post('/auth/users', data),
  updateUserRole: (userId, data) => api.patch(`/auth/users/${userId}/role`, data),
  deleteUser: (userId) => api.delete(`/auth/users/${userId}`),
  getUsers: (params) => api.get('/auth/users', { params })
};
