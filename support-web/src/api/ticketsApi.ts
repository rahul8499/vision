import apiClient from './axios'
import type { Ticket, TicketListParams, TicketCreateRequest, TicketReplyRequest, PaginatedResponse } from '@/types/auth'

export const ticketsApi = {
  getAll: async (params?: TicketListParams): Promise<PaginatedResponse<Ticket>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Ticket> }>('/tickets/', { params })
    return response.data.data
  },

  getOne: async (id: string): Promise<Ticket> => {
    const response = await apiClient.get(`/tickets/${id}/`)
    return response.data.data
  },

  create: async (data: TicketCreateRequest): Promise<Ticket> => {
    const response = await apiClient.post('/tickets/', data)
    return response.data.data
  },

  update: async (id: string, data: Record<string, unknown>): Promise<Ticket> => {
    const response = await apiClient.put(`/tickets/${id}/`, data)
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tickets/${id}/`)
  },

  reply: async (id: string, data: TicketReplyRequest): Promise<unknown> => {
    const response = await apiClient.post(`/tickets/${id}/reply/`, data)
    return response.data.data
  },

  addInternalNote: async (id: string, body: string): Promise<unknown> => {
    const response = await apiClient.post(`/tickets/${id}/notes/`, { body })
    return response.data.data
  },

  assign: async (id: string, agentId: string): Promise<Ticket> => {
    const response = await apiClient.post(`/tickets/${id}/assign/`, { agentId })
    return response.data.data
  },

  bulkAssign: async (ids: string[], agentId: string): Promise<unknown> => {
    const response = await apiClient.post('/tickets/bulk-assign/', { ids, agentId })
    return response.data.data
  },

  bulkClose: async (ids: string[]): Promise<unknown> => {
    const response = await apiClient.post('/tickets/bulk-close/', { ids })
    return response.data.data
  },
}
