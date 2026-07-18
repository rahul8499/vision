import apiClient from './axios'
import type { SafetyReport, SafetyReportListParams, PaginatedResponse } from '@/types/auth'

export const safetyReportsApi = {
  getAll: async (params?: SafetyReportListParams): Promise<PaginatedResponse<SafetyReport>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<SafetyReport> }>('/safety-reports/', { params })
    return response.data.data
  },

  getOne: async (id: string): Promise<SafetyReport> => {
    const response = await apiClient.get(`/safety-reports/${id}/`)
    return response.data.data
  },

  update: async (id: string, data: Record<string, unknown>): Promise<SafetyReport> => {
    const response = await apiClient.put(`/safety-reports/${id}/`, data)
    return response.data.data
  },

  assign: async (id: string, action: string, note?: string, targetUserId?: number, targetStoreId?: number): Promise<unknown> => {
    const response = await apiClient.post(`/safety-reports/${id}/action/`, { action, note, target_user_id: targetUserId, target_store_id: targetStoreId })
    return response.data.data
  },

  addInternalNote: async (id: string, body: string): Promise<unknown> => {
    const response = await apiClient.post(`/safety-reports/${id}/notes/`, { body })
    return response.data.data
  },
}
