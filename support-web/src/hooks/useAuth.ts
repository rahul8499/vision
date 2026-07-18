import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/authApi'

export const useAuth = () => {
  const { login, logout, updateProfile, isLoading, refreshTokens, isAuthenticated, user } = useAuthStore()

  const handleLogin = async (email: string, password: string) => {
    await login(email, password)
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore logout errors
    } finally {
      logout()
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    refreshTokens,
    updateProfile,
  }
}
