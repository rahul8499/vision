export type StaffStatus = 'active' | 'inactive' | 'suspended'

export interface StaffMember {
  id: string
  email: string
  name: string
  role: import('./auth').UserRole
  status: StaffStatus
  phone?: string
  department?: string
  employeeId?: string
  permissions: string[]
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface StaffCreateRequest {
  name: string
  email: string
  password: string
  role: import('./auth').UserRole
  employeeId: string
  department?: string
  phone?: string
}

export interface StaffUpdateRequest {
  name?: string
  email?: string
  role?: import('./auth').UserRole
  department?: string
  phone?: string
  isActive?: boolean
}

export interface StaffListParams {
  page?: number
  limit?: number
  search?: string
  role?: string
  status?: StaffStatus | ''
  department?: string
  sortBy?: 'createdAt' | 'email' | 'role'
  sortOrder?: 'asc' | 'desc'
}

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800',
}
