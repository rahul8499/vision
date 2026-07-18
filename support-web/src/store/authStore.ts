import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types/auth'
import { authApi } from '@/api/authApi'
import toast from 'react-hot-toast'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setTokens: (accessToken: string, refreshToken: string, user: User) => void
  logout: () => void
  login: (email: string, password: string) => Promise<void>
  refreshTokens: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (accessToken, refreshToken, user) => {
        set({ accessToken, refreshToken, user, isAuthenticated: true, isLoading: false })
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          const response = await authApi.login({ email, password })
          const { access, refresh, staff } = response
          set({ accessToken: access, refreshToken: refresh, user: staff, isAuthenticated: true, isLoading: false })
          toast.success('Welcome back!')
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      refreshTokens: async () => {
        try {
          const { refreshToken } = get()
          if (!refreshToken) throw new Error('No refresh token')
          const response = await authApi.refresh({ refresh: refreshToken })
          const { access, refresh, staff } = response
          set({ accessToken: access, refreshToken: refresh, user: staff })
        } catch (error) {
          get().logout()
          throw error
        }
      },

      updateProfile: async (data: Partial<User>) => {
        try {
          const updatedUser = await authApi.updateProfile(data)
          set({ user: updatedUser })
          toast.success('Profile updated successfully')
        } catch (error) {
          toast.error('Failed to update profile')
          throw error
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useCurrentUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useHasRole = (role: UserRole) => {
  const user = useCurrentUser()
  return user?.role === role
}
export const useHasAnyRole = (roles: UserRole[]) => {
  const user = useCurrentUser()
  return user ? roles.includes(user.role) : false
}
