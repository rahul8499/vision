import apiClient from './axios'

export const operationsApi = {
  getOverview: async () => (await apiClient.get('/operations/')).data.data,
  markRead: async (id: number) => apiClient.post(`/notifications/${id}/read/`),
  markAllRead: async () => apiClient.post('/notifications/mark-all-read/'),
  addContact: async (data: Record<string, unknown>) => (await apiClient.post('/contact-logs/', data)).data.data,
  addSavedReply: async (data: Record<string, unknown>) => (await apiClient.post('/saved-replies/', data)).data.data,
  getSavedReplies: async () => (await apiClient.get('/saved-replies/')).data.data.results,
  getContacts: async (entityType: string, objectId: string | number) => (await apiClient.get('/contact-logs/', { params: { entity_type: entityType, object_id: objectId } })).data.data.results,
}
