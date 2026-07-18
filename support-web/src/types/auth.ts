export interface PaginatedResponse<T> {
  results: T[]
  pagination: {
    page: number
    page_size: number
    total_pages: number
    total_count: number
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RefreshTokenRequest {
  refresh: string
}

export interface AuthResponse {
  access: string
  refresh: string
  staff: User
  sessionKey?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  permissions: string[]
  employeeId?: string
  department?: string
  phone?: string
  timezone?: string
  isActive: boolean
  lastSeenAt?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'agent' | 'supervisor' | 'admin'

export const ROLE_LABELS: Record<UserRole, string> = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  agent: 'bg-yellow-100 text-yellow-800',
  supervisor: 'bg-blue-100 text-blue-800',
  admin: 'bg-purple-100 text-purple-800',
}

export interface TokenPayload {
  sub: string
  role: UserRole
  permissions: string[]
  iat: number
  exp: number
}

export interface UpdateProfileRequest {
  department?: string
  phone?: string
  timezone?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}
