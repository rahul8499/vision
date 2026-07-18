export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  isRead: boolean
  readAt?: string
  createdAt: string
}

export type NotificationType = 'complaint' | 'ticket' | 'refund' | 'safety_report' | 'system' | 'assignment'

export interface NotificationListParams {
  page?: number
  limit?: number
  isRead?: boolean
  type?: NotificationType | ''
  dateFrom?: string
  dateTo?: string
}

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  complaintAlerts: boolean
  ticketAlerts: boolean
  refundAlerts: boolean
  safetyAlerts: boolean
  systemAlerts: boolean
}

export interface MarkAsReadRequest {
  notificationId: string
}

export interface MarkAllAsReadRequest {
  type?: NotificationType
}
