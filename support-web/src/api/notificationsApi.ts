import apiClient from './axios'
import type { Notification, NotificationListParams, NotificationPreferences } from '@/types/notifications'
import type { PaginatedResponse } from '@/types/auth'

const normalize = (raw: Record<string, any>): Notification => ({ id: String(raw.id), type: raw.notification_type || 'system', title: raw.title || 'Notification', message: raw.message || '', data: { entityType: raw.entity_type, entityId: raw.entity_id }, isRead: !!raw.is_read, createdAt: raw.created_at })

export const notificationsApi = {
  getAll: async (params?: NotificationListParams): Promise<PaginatedResponse<Notification>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Record<string, any>> }>('/notifications/', { params: { page: params?.page, page_size: params?.limit, is_read: params?.isRead, notification_type: params?.type } })
    return { ...response.data.data, results: response.data.data.results.map(normalize) }
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get('/notifications/unread-count/')
    return Number(response.data.data?.unread_count ?? 0)
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
