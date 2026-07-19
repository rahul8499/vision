import apiClient from './axios'
import type { LoginRequest, RefreshTokenRequest, UpdateProfileRequest, ChangePasswordRequest, User, AuthResponse } from '@/types/auth'

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login/', data)
    return response.data.data
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
    return response.data.data
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.patch<{ success: boolean; data: User }>('/auth/me/', data)
    return response.data.data
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post('/auth/change-password/', data)
  },
}
