import apiClient from './axios'
import { staffApi } from './staffApi'
import { operationsApi } from './operationsApi'
import type { StaffMember } from '@/types/staff'

export type RuntimeHealth = {
  healthy: boolean
  redis: { ok: boolean }
  automation: { ok: boolean; last_heartbeat: string | null }
}

export type ProductionLog = {
  id: number | string
  category?: string
  action?: string
  title?: string
  details?: Record<string, unknown>
  actor_type?: string
  actor_id?: string
  subject_type?: string
  subject_id?: string
  created_at?: string
}

export type MonitoringSnapshot = {
  health: RuntimeHealth
  errors: ProductionLog[]
  slowRequests: ProductionLog[]
  activeStaff: StaffMember[]
  allStaff: StaffMember[]
}

const getLogs = async (action: 'api_failure' | 'slow_api') => {
  const response = await apiClient.get('/activity-logs/', {
    params: {
      category: 'production_log',
      action,
      page_size: 25,
    },
  })
  return response.data.data.results as ProductionLog[]
}

export const monitoringApi = {
  getSnapshot: async (): Promise<MonitoringSnapshot> => {
    const [health, errors, slowRequests, staffResponse] = await Promise.all([
      operationsApi.getRuntimeHealth(),
      getLogs('api_failure'),
      getLogs('slow_api'),
      staffApi.getAll({ limit: 100 }),
    ])

    const allStaff = staffResponse.results
    return {
      health,
      errors,
      slowRequests,
      allStaff,
      activeStaff: allStaff.filter((staff) => staff.status === 'active'),
    }
  },
}
