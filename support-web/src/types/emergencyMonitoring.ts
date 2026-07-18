export interface EmergencyCity {
  id: number
  name: string
  state: string
  zones: Array<{ id: number; name: string }>
}

export interface EmergencyDispatchRow {
  id: number
  prescriptionId: number
  requestType: 'emergency' | 'normal'
  storeId: number
  storeName: string
  storeMobile: string
  cityId?: number
  cityName: string
  serviceZoneName: string
  distanceKm?: number
  batchNumber: number
  status: string
  notifiedAt: string
  openedAt?: string
  respondedAt?: string
  firstReminderAt?: string
  secondReminderAt?: string
  reminderCount: number
  manualReminderCount: number
  lastManualReminderAt?: string
  remindersSuppressedAt?: string
  supportContactedAt?: string
  manualCooldownSeconds: number
  escalatedAt?: string
  waitingSeconds: number
  pushAvailable: boolean
  lastNotificationError: string
}

export interface EmergencyPolicy {
  firstStoreReminderSeconds: number
  secondStoreReminderSeconds: number
  supportEscalationSeconds: number
  maxStoreReminders: number
  remindersEnabled: boolean
  supportEscalationEnabled: boolean
  manualReminderCooldownSeconds: number
  manualReminderDailyLimit: number
}
