import apiClient from './axios'
import type { Notification, NotificationListParams, NotificationPreferences, PaginatedResponse } from '@/types/auth'

export const notificationsApi = {
  getAll: async (params?: NotificationListParams): Promise<PaginatedResponse<Notification>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Notification> }>('/notifications/', { params })
    return response.data.data
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get('/notifications/unread-count/')
    return response.data.data
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.post(`/notifications/${id}/read/`)
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.post('/notifications/mark-all-read/')
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get('/notifications/preferences/')
    return response.data.data
  },

  updatePreferences: async (data: NotificationPreferences): Promise<NotificationPreferences> => {
    const response = await apiClient.put('/notifications/preferences/', data)
    return response.data.data
  },
}
