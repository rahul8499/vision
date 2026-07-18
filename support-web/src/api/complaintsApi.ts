import apiClient from './axios'
import type { Complaint, ComplaintListParams, ComplaintCreateRequest, ComplaintUpdateRequest, ComplaintReplyRequest, PaginatedResponse } from '@/types/auth'

export const complaintsApi = {
  getAll: async (params?: ComplaintListParams): Promise<PaginatedResponse<Complaint>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Complaint> }>('/complaints/', { params })
    return response.data.data
  },

  getOne: async (id: string): Promise<Complaint> => {
    const response = await apiClient.get(`/complaints/${id}/`)
    return response.data.data
  },

  create: async (data: ComplaintCreateRequest): Promise<Complaint> => {
    const response = await apiClient.post('/complaints/', data)
    return response.data.data
  },

  update: async (id: string, data: ComplaintUpdateRequest): Promise<Complaint> => {
    const response = await apiClient.put(`/complaints/${id}/`, data)
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/complaints/${id}/`)
  },

  reply: async (id: string, data: ComplaintReplyRequest): Promise<unknown> => {
    const response = await apiClient.post(`/complaints/${id}/reply/`, data)
    return response.data.data
  },

  addInternalNote: async (id: string, body: string): Promise<unknown> => {
    const response = await apiClient.post(`/complaints/${id}/notes/`, { body })
    return response.data.data
  },

  assign: async (id: string, agentId: string): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/assign/`, { agentId })
    return response.data.data
  },

  bulkAssign: async (ids: string[], agentId: string): Promise<unknown> => {
    const response = await apiClient.post('/complaints/bulk-assign/', { ids, agentId })
    return response.data.data
  },

  bulkClose: async (ids: string[]): Promise<unknown> => {
    const response = await apiClient.post('/complaints/bulk-close/', { ids })
    return response.data.data
  },
}
