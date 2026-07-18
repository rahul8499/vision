import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  permissions: string[]
  children: ReactNode
  fallback?: ReactNode
  requireAll?: boolean
}

export const PermissionGuard = ({ permissions, children, fallback = null, requireAll = false }: PermissionGuardProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()

  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
