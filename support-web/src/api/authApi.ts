import apiClient from './axios'
import type { LoginRequest, RefreshTokenRequest, UpdateProfileRequest, ChangePasswordRequest, User, AuthResponse } from '@/types/auth'

const normalizeUser = (raw: Record<string, any>): User => ({
  id: String(raw.id), email: raw.email, name: raw.name, role: raw.role,
  permissions: raw.permissions || [], employeeId: raw.employeeId || raw.employee_id,
  department: raw.department, phone: raw.phone, timezone: raw.timezone,
  isActive: raw.isActive ?? raw.is_active, lastSeenAt: raw.lastSeenAt || raw.last_seen_at,
  createdAt: raw.createdAt || raw.created_at, updatedAt: raw.updatedAt || raw.updated_at,
})

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login/', data)
    return { ...response.data.data, staff: normalizeUser(response.data.data.staff as unknown as Record<string, any>) }
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout/')
  },

  refresh: async (data: RefreshTokenRequest): Promise<Pick<AuthResponse, 'access' | 'refresh'>> => {
    const response = await apiClient.post<{ success: boolean; data: Pick<AuthResponse, 'access' | 'refresh'> }>('/auth/refresh/', data)
    return response.data.data
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me/')
    return normalizeUser(response.data.data as unknown as Record<string, any>)
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.patch<{ success: boolean; data: User }>('/auth/me/', data)
    return normalizeUser(response.data.data as unknown as Record<string, any>)
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post('/auth/change-password/', data)
  },
}
