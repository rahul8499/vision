import apiClient from './axios'
import type { Refund, RefundListParams, RefundApproveRequest, RefundRejectRequest, RefundProcessRequest } from '@/types/refunds'

type Raw = Record<string, any>
type RefundPage = {
  results: Refund[]
  pagination: {
    page: number
    page_size: number
    total_pages: number
    total_count: number
  }
}

const normalizeRefund = (raw: Raw): Refund => ({
  id: raw.id,
  cityId: raw.city_id ?? undefined,
  cityName: raw.city_name || undefined,
  charge: String(raw.charge),
  source: raw.source || 'support_request',
  sourceDisplay: raw.source_display || 'Support request',
  isActionable: raw.is_actionable ?? true,
  currency: raw.currency || 'INR',
  prescriptionResponse: raw.prescription_response ?? undefined,
  requestedById: raw.requested_by,
  requestedByName: raw.requested_by_name || 'System',
  assignedToId: raw.assigned_to ?? undefined,
  assignedToName: raw.assigned_to_name || undefined,
  reviewedById: raw.reviewed_by ?? undefined,
  reviewedByName: raw.reviewed_by_name || undefined,
  status: raw.status,
  amount: Number(raw.amount || 0),
  reason: raw.reason || '',
  rejectionReason: raw.rejection_reason || undefined,
  paymentGateway: raw.payment_gateway || undefined,
  paymentReference: raw.payment_reference || undefined,
  processedAt: raw.processed_at || undefined,
  approvedAt: raw.approved_at || undefined,
  metadata: raw.metadata || {},
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
})

export const refundsApi = {
  getAll: async (params?: RefundListParams): Promise<RefundPage> => {
    const response = await apiClient.get<{ success: boolean; data: RefundPage }>('/refunds/', {
      params: {
        page: params?.page,
        page_size: params?.limit,
        search: params?.search,
        status: params?.status,
        date_from: params?.dateFrom,
        date_to: params?.dateTo,
        city: params?.city,
      },
    })
    return {
      ...response.data.data,
      results: response.data.data.results.map(normalizeRefund),
    }
  },

  getOne: async (id: string): Promise<Refund> => {
    const response = await apiClient.get(`/refunds/${id}/`)
    return normalizeRefund(response.data.data)
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
  assign: async (id: string, agentId: string): Promise<Refund> => {
    const response = await apiClient.post(`/refunds/${id}/assign/`, { assigned_to: agentId })
    return normalizeRefund(response.data.data)
  },
}
