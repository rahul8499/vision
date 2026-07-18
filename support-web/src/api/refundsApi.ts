import apiClient from './axios'
import type { Refund, RefundListParams, RefundApproveRequest, RefundRejectRequest, RefundProcessRequest, PaginatedResponse } from '@/types/auth'

export const refundsApi = {
  getAll: async (params?: RefundListParams): Promise<PaginatedResponse<Refund>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Refund> }>('/refunds/', { params })
    return response.data.data
  },

  getOne: async (id: string): Promise<Refund> => {
    const response = await apiClient.get(`/refunds/${id}/`)
    return response.data.data
  },

  approve: async (id: string, data?: RefundApproveRequest): Promise<Refund> => {
    const response = await apiClient.post(`/refunds/${id}/approve/`, data)
    return response.data.data
  },

  reject: async (id: string, data: RefundRejectRequest): Promise<Refund> => {
    const response = await apiClient.post(`/refunds/${id}/reject/`, data)
    return response.data.data
  },

  process: async (id: string, data: RefundProcessRequest): Promise<Refund> => {
    const response = await apiClient.post(`/refunds/${id}/process/`, data)
    return response.data.data
  },

  cancel: async (id: string): Promise<Refund> => {
    const response = await apiClient.post(`/refunds/${id}/cancel/`)
    return response.data.data
  },
}
