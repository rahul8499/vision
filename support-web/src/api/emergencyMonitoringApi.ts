import apiClient from './axios'
import type { EmergencyCity, EmergencyDispatchRow, EmergencyPolicy } from '@/types/emergencyMonitoring'

const row = (raw: Record<string, any>): EmergencyDispatchRow => ({
  id: raw.id,
  prescriptionId: raw.prescription_id,
  requestType: raw.request_type,
  storeId: raw.store_id,
  storeName: raw.store_name,
  storeMobile: raw.store_mobile,
  cityId: raw.city_id || undefined,
  cityName: raw.city_name,
  serviceZoneName: raw.service_zone_name,
  distanceKm: raw.distance_km == null ? undefined : Number(raw.distance_km),
  batchNumber: raw.batch_number,
  status: raw.status,
  notifiedAt: raw.notified_at,
  openedAt: raw.opened_at || undefined,
  respondedAt: raw.responded_at || undefined,
  firstReminderAt: raw.first_reminder_at || undefined,
  secondReminderAt: raw.second_reminder_at || undefined,
  reminderCount: raw.reminder_count,
  manualReminderCount: raw.manual_reminder_count,
  lastManualReminderAt: raw.last_manual_reminder_at || undefined,
  remindersSuppressedAt: raw.reminders_suppressed_at || undefined,
  supportContactedAt: raw.support_contacted_at || undefined,
  manualCooldownSeconds: raw.manual_cooldown_seconds,
  escalatedAt: raw.escalated_at || undefined,
  waitingSeconds: raw.waiting_seconds,
  pushAvailable: raw.push_available,
  lastNotificationError: raw.last_notification_error,
})

const policy = (raw: Record<string, any>): EmergencyPolicy => ({
  firstStoreReminderSeconds: raw.first_store_reminder_seconds,
  secondStoreReminderSeconds: raw.second_store_reminder_seconds,
  supportEscalationSeconds: raw.support_escalation_seconds,
  maxStoreReminders: raw.max_store_reminders,
  remindersEnabled: raw.reminders_enabled,
  supportEscalationEnabled: raw.support_escalation_enabled,
  manualReminderCooldownSeconds: raw.manual_reminder_cooldown_seconds,
  manualReminderDailyLimit: raw.manual_reminder_daily_limit,
})

export const emergencyMonitoringApi = {
  getCities: async (): Promise<EmergencyCity[]> => (await apiClient.get('/emergency-monitoring/cities/')).data.data,
  getRows: async (params: Record<string, string | number | undefined>) => {
    const raw = (await apiClient.get('/emergency-monitoring/', { params })).data.data
    return { results: raw.results.map(row), summary: raw.summary, pagination: raw.pagination }
  },
  remind: async (id: number) => apiClient.post(`/emergency-monitoring/${id}/remind/`),
  action: async (id: number, action: 'mark_contacted' | 'suppress_reminders' | 'resume_reminders') => apiClient.post(`/emergency-monitoring/${id}/action/`, { action }),
  getPolicy: async (city: string, requestType: string): Promise<EmergencyPolicy> => policy((await apiClient.get('/emergency-monitoring/policy/', { params: { city: city || undefined, request_type: requestType } })).data.data),
  updatePolicy: async (values: EmergencyPolicy, city: string, requestType: string) => apiClient.patch('/emergency-monitoring/policy/', {
    city: city || undefined,
    request_type: requestType,
    first_store_reminder_seconds: values.firstStoreReminderSeconds,
    second_store_reminder_seconds: values.secondStoreReminderSeconds,
    support_escalation_seconds: values.supportEscalationSeconds,
    max_store_reminders: values.maxStoreReminders,
    reminders_enabled: values.remindersEnabled,
    support_escalation_enabled: values.supportEscalationEnabled,
    manual_reminder_cooldown_seconds: values.manualReminderCooldownSeconds,
    manual_reminder_daily_limit: values.manualReminderDailyLimit,
  }),
}
