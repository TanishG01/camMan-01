import api from '../api';

export const assignmentsApi = {
  getAssignments: (params) => api.get('/assignments', { params }),
  createAssignment: (data) => api.post('/assignments', data),
  suggestAssignments: (eventId) => api.post('/assignments/suggest', { eventId }),
  approveAssignment: (id) => api.post(`/assignments/${id}/approve`),
  rejectAssignment: (id, reason) => api.post(`/assignments/${id}/reject`, { reason }),
  deleteAssignment: (id) => api.delete(`/assignments/${id}`),
  reassignMember: (id, newMemberId, reason) => api.post(`/assignments/${id}/reassign`, { newMemberId, reason }),
  assignMentor: (id, mentorId) => api.post(`/assignments/${id}/assign-mentor`, { mentorId }),
  requestMentor: (id) => api.post(`/assignments/${id}/request-mentor`),
  confirmContribution: (id, actuallyContributed) => api.patch(`/assignments/${id}/confirm-contribution`, { actuallyContributed })
};
