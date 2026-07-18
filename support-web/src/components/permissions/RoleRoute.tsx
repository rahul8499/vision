import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { FullPageLoading } from '@/components/common/Loading'
import type { ReactNode } from 'react'
import type { UserRole } from '@/types/auth'

interface RoleRouteProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallback?: ReactNode
}

export const RoleRoute = ({ children, allowedRoles, fallback }: RoleRouteProps) => {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) {
    return <FullPageLoading />
  }

  if (!user || !allowedRoles.includes(user.role)) {
    if (fallback) return <>{fallback}</>
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
