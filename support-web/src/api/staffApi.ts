import apiClient from './axios'
import type { PaginatedResponse } from '@/types/auth'
import type { StaffMember, StaffListParams, StaffCreateRequest, StaffUpdateRequest } from '@/types/staff'

type RawStaff = Record<string, unknown>

const normalizeStaff = (raw: RawStaff): StaffMember => ({
  id: String(raw.id),
  email: String(raw.email ?? ''),
  name: String(raw.name ?? raw.email ?? 'Support staff'),
  role: raw.role as StaffMember['role'],
  status: raw.is_active === false ? 'inactive' : 'active',
  phone: raw.phone ? String(raw.phone) : undefined,
  department: raw.department ? String(raw.department) : undefined,
  employeeId: raw.employee_id ? String(raw.employee_id) : undefined,
  // Permissions are role-derived on the backend and are not part of the staff
  // detail serializer. Keep the UI safe until explicit permissions are exposed.
  permissions: Array.isArray(raw.permissions)
    ? raw.permissions.filter((item): item is string => typeof item === 'string')
    : [],
  lastLoginAt: raw.last_seen_at ? String(raw.last_seen_at) : undefined,
  createdAt: String(raw.created_at ?? ''),
  updatedAt: String(raw.updated_at ?? raw.created_at ?? ''),
})

export const staffApi = {
  getAll: async (params?: StaffListParams): Promise<PaginatedResponse<StaffMember>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<RawStaff> }>('/staff/', {
      params: {
        page: params?.page,
        page_size: params?.limit,
        role: params?.role,
        is_active: params?.status ? params.status === 'active' : undefined,
        department: params?.department,
      },
    })
    return {
      ...response.data.data,
      results: response.data.data.results.map(normalizeStaff),
    }
  },

  getOne: async (id: string): Promise<StaffMember> => {
    const response = await apiClient.get(`/staff/${id}/`)
    return normalizeStaff(response.data.data)
  },

  create: async (data: StaffCreateRequest): Promise<StaffMember> => {
    const response = await apiClient.post('/staff/', {
      ...data,
      employee_id: data.employeeId,
    })
    return normalizeStaff(response.data.data)
  },

  update: async (id: string, data: StaffUpdateRequest): Promise<StaffMember> => {
    const response = await apiClient.patch(`/staff/${id}/`, {
      role: data.role,
      department: data.department,
      phone: data.phone,
      is_active: data.isActive,
    })
    return normalizeStaff(response.data.data)
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/staff/${id}/`)
  },

  updatePermissions: async (id: string, permissions: string[]): Promise<StaffMember> => {
    const response = await apiClient.put(`/staff/${id}/permissions/`, { permissions })
    return normalizeStaff(response.data.data)
  },
}
