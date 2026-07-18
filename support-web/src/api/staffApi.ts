import apiClient from './axios'
import type { StaffMember, StaffListParams, StaffCreateRequest, StaffUpdateRequest, PaginatedResponse } from '@/types/auth'

export const staffApi = {
  getAll: async (params?: StaffListParams): Promise<PaginatedResponse<StaffMember>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<StaffMember> }>('/staff/', { params })
    return response.data.data
  },

  getOne: async (id: string): Promise<StaffMember> => {
    const response = await apiClient.get(`/staff/${id}/`)
    return response.data.data
  },

  create: async (data: StaffCreateRequest): Promise<StaffMember> => {
    const response = await apiClient.post('/staff/', data)
    return response.data.data
  },

  update: async (id: string, data: StaffUpdateRequest): Promise<StaffMember> => {
    const response = await apiClient.put(`/staff/${id}/`, data)
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/staff/${id}/`)
  },

  updatePermissions: async (id: string, permissions: string[]): Promise<StaffMember> => {
    const response = await apiClient.put(`/staff/${id}/permissions/`, { permissions })
    return response.data.data
  },
}
