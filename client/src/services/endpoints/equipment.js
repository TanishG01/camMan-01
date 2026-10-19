import api from '../api';

export const equipmentApi = {
  getEquipment: (params) => api.get('/equipment', { params }),
  getEquipmentById: (id) => api.get(`/equipment/${id}`),
  createEquipment: (data) => api.post('/equipment', data),
  updateCondition: (id, data) => api.patch(`/equipment/${id}/condition`, data),
  reserveEquipment: (id, data) => api.post(`/equipment/${id}/reserve`, data),
  allocateEquipment: (id, data) => api.post(`/equipment/${id}/allocate`, data),
  checkoutEquipment: (id, data) => api.post(`/equipment/${id}/checkout`, data),
  takeEquipment: (id, data) => api.post(`/equipment/${id}/take`, data),
  returnEquipment: (id, data) => api.post(`/equipment/${id}/return`, data),
  reportLost: (id, data) => api.post(`/equipment/${id}/report-lost`, data),
  checkSequentialFeasibility: (id, params) => api.get(`/equipment/${id}/sequential-feasibility`, { params })
};
