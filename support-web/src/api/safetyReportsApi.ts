import apiClient from './axios'
import type {
  SafetyAction, SafetyInternalNote, SafetyReport, SafetyReportAction, SafetyReportListParams,
} from '@/types/safety'
import type { PaginatedResponse } from '@/types/auth'

type Raw = Record<string, any>
const pick = (raw: Raw, camel: string, snake: string) => raw[camel] ?? raw[snake]

const normalizeAction = (raw: Raw): SafetyReportAction => ({
  id: Number(raw.id),
  action: String(raw.action),
  adminName: String(pick(raw, 'adminName', 'admin_name') || 'Support team'),
  note: String(raw.note || ''),
  targetUserId: pick(raw, 'targetUserId', 'target_user') ?? undefined,
  targetStoreId: pick(raw, 'targetStoreId', 'target_store') ?? undefined,
  createdAt: String(pick(raw, 'createdAt', 'created_at') || ''),
})

const normalizeNote = (raw: Raw): SafetyInternalNote => ({
  id: Number(raw.id),
  body: String(raw.body || ''),
  createdByName: String(pick(raw, 'createdByName', 'created_by_name') || 'Support team'),
  isPinned: Boolean(pick(raw, 'isPinned', 'is_pinned')),
  createdAt: String(pick(raw, 'createdAt', 'created_at') || ''),
})

const normalizeReport = (raw: Raw): SafetyReport => ({
  id: Number(raw.id),
  reporterType: pick(raw, 'reporterType', 'reporter_type') || 'user',
  reporterName: String(pick(raw, 'reporterName', 'reporter_name') || 'Unknown'),
  targetType: pick(raw, 'targetType', 'target_type') || 'store',
  reportedName: String(pick(raw, 'reportedName', 'reported_name') || 'Unknown'),
  reportedUserId: pick(raw, 'reportedUserId', 'reported_user') ?? undefined,
  reportedStoreId: pick(raw, 'reportedStoreId', 'reported_store') ?? undefined,
  category: raw.category || 'other',
  severity: raw.severity || 'medium',
  scope: raw.scope || 'GLOBAL',
  cityId: pick(raw, 'cityId', 'city') ?? undefined,
  cityName: pick(raw, 'cityName', 'city_name') || undefined,
  description: String(raw.description || ''),
  status: raw.status || 'submitted',
  resolutionNote: pick(raw, 'resolutionNote', 'resolution_note') || undefined,
  prescriptionId: pick(raw, 'prescriptionId', 'prescription') ?? undefined,
  responseId: pick(raw, 'responseId', 'response') ?? undefined,
  assignedToId: pick(raw, 'assignedToId', 'assigned_to_id') ?? undefined,
  assignedToName: pick(raw, 'assignedToName', 'assigned_to_name') || undefined,
  actionHistory: (pick(raw, 'actionHistory', 'action_history') || []).map(normalizeAction),
  internalNotes: (pick(raw, 'internalNotes', 'internal_notes') || []).map(normalizeNote),
  createdAt: String(pick(raw, 'createdAt', 'created_at') || ''),
  updatedAt: String(pick(raw, 'updatedAt', 'updated_at') || ''),
})

export const safetyReportsApi = {
  getAll: async (params?: SafetyReportListParams): Promise<PaginatedResponse<SafetyReport>> => {
    const response = await apiClient.get('/safety-reports/', {
      params: {
        page: params?.page,
        page_size: params?.limit,
        q: params?.search,
        status: params?.status,
        severity: params?.severity,
        category: params?.category,
        reporter_type: params?.reporterType,
        target_type: params?.targetType,
        scope: params?.scope,
        assigned_to: params?.assignedTo,
        city: params?.city,
        date_from: params?.dateFrom,
        date_to: params?.dateTo,
      },
    })
    const data = response.data.data
    return { ...data, results: (data.results || []).map(normalizeReport) }
  },
  getOne: async (id: string): Promise<SafetyReport> =>
    normalizeReport((await apiClient.get(`/safety-reports/${id}/`)).data.data),
  assignToMe: async (id: string): Promise<SafetyReport> =>
    normalizeReport((await apiClient.post(`/safety-reports/${id}/assign/`, {})).data.data),
  action: async (id: string, action: SafetyAction, note: string): Promise<unknown> =>
    (await apiClient.post(`/safety-reports/${id}/action/`, { action, note })).data.data,
  addInternalNote: async (id: string, body: string): Promise<SafetyInternalNote> =>
    normalizeNote((await apiClient.post(`/safety-reports/${id}/notes/`, { body })).data.data),
}
