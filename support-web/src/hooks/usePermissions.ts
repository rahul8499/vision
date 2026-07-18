import { useMemo } from 'react'
import { useCurrentUser } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

export const usePermissions = () => {
  const user = useCurrentUser()

  const hasPermission = useMemo(() => {
    return (permission: string): boolean => {
      if (!user) return false
      return user.permissions.includes(permission)
    }
  }, [user])

  const hasAnyPermission = useMemo(() => {
    return (permissions: string[]): boolean => {
      if (!user) return false
      return permissions.some((p) => user.permissions.includes(p))
    }
  }, [user])

  const hasAllPermissions = useMemo(() => {
    return (permissions: string[]): boolean => {
      if (!user) return false
      return permissions.every((p) => user.permissions.includes(p))
    }
  }, [user])

  const hasRole = useMemo(() => {
    return (role: UserRole): boolean => {
      if (!user) return false
      return user.role === role
    }
  }, [user])

  const hasAnyRole = useMemo(() => {
    return (roles: UserRole[]): boolean => {
      if (!user) return false
      return roles.includes(user.role)
    }
  }, [user])

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    role: user?.role ?? null,
    permissions: user?.permissions ?? [],
  }
}
