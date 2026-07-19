import apiClient from './axios'

export const operationsApi = {
  getOverview: async () => (await apiClient.get('/operations/')).data.data,
  getRuntimeHealth: async () => (await apiClient.get('/health/runtime/')).data.data as { healthy: boolean; redis: { ok: boolean }; automation: { ok: boolean; last_heartbeat: string | null } },
  markRead: async (id: number) => apiClient.post(`/notifications/${id}/read/`),
  markAllRead: async () => apiClient.post('/notifications/mark-all-read/'),
  addContact: async (data: Record<string, unknown>) => (await apiClient.post('/contact-logs/', data)).data.data,
  addSavedReply: async (data: Record<string, unknown>) => (await apiClient.post('/saved-replies/', data)).data.data,
  getSavedReplies: async () => (await apiClient.get('/saved-replies/')).data.data.results,
  getContacts: async (entityType: string, objectId: string | number) => (await apiClient.get('/contact-logs/', { params: { entity_type: entityType, object_id: objectId } })).data.data.results,
  assignCase: async (type: string, id: number, staffId: string) => {
    if (type === 'complaint') return apiClient.post(`/complaints/${id}/assign/`, { assigned_to: staffId })
    if (type === 'ticket') return apiClient.post(`/tickets/${id}/assign/`, { assigned_to: staffId })
    if (type === 'refund') return apiClient.post(`/refunds/${id}/assign/`, { assigned_to: staffId })
    if (type === 'safety_report') return apiClient.post(`/safety-reports/${id}/assign/`, { assigned_to_id: staffId })
    throw new Error('This case type cannot be assigned.')
  },
  assignToMe: async (type: string, id: number) => apiClient.post(`/cases/${type}/${id}/assign-to-me/`),
  getSlaSettings: async () => (await apiClient.get('/sla-settings/')).data.data,
  updateSla: async (id: number, data: Record<string, unknown>) => (await apiClient.patch(`/sla-settings/${id}/`, data)).data.data,
  addHoliday: async (data: { date: string; name: string }) => (await apiClient.post('/sla-holidays/', data)).data.data,
  removeHoliday: async (id: number) => apiClient.delete(`/sla-holidays/${id}/`),
  updateContact: async (id: number, data: Record<string, unknown>) => (await apiClient.patch(`/contact-logs/${id}/`, data)).data.data,
  updateSavedReply: async (id: number, data: Record<string, unknown>) => (await apiClient.patch(`/saved-replies/${id}/`, data)).data.data,
  deactivateSavedReply: async (id: number) => apiClient.delete(`/saved-replies/${id}/`),
}
