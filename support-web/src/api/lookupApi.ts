import apiClient from './axios'

export interface UserSearchResult {
  id: string
  email: string
  name: string
  mobile: string
  isActive: boolean
  isVerified: boolean
}

export interface UserOrder {
  id: string
  prescriptionId: number
  storeName: string
  totalAmount: number
  userStatus: string
  deliveryOption: string
  createdAt: string
}

export interface UserPrescription {
  id: number
  medicineName: string
  description: string
  createdAt: string
  targetStores: { id: string; name: string }[]
}

export interface UserComplaint {
  id: string
  category: string
  subject: string
  status: string
  priority: string
  createdAt: string
  against: { type: string; id: string; name: string } | null
}

export interface UserTicket {
  id: string
  category: string
  subject: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
}

export interface UserRefund {
  id: string
  amount: number
  status: string
  reason: string
  createdAt: string
  processedAt: string | null
}

export interface UserSafetyReport {
  id: string
  reason: string
  status: string
  createdAt: string
  reportedBy: { type: string; id: string; name: string } | null
  reportedAgainst: { type: string; id: string; name: string } | null
}

export interface UserProfile {
  id: string
  name: string
  mobile: string
  email: string
  address: string
  pincode: string
  isActive: boolean
  isVerified: boolean
  isDeleted: boolean
  preferredLanguage: string
  orders: UserOrder[]
  prescriptions: UserPrescription[]
  complaints: UserComplaint[]
  tickets: UserTicket[]
  refunds: UserRefund[]
  safetyReportsFiled: UserSafetyReport[]
  safetyReportsAgainst: UserSafetyReport[]
}

export interface StoreSearchResult {
  id: string
  name: string
  ownerName: string
  mobile: string
  email: string
  address: string
  pincode: string
  isActive: boolean
  isVerified: boolean
  averageRating: number
  totalRatings: number
  autoAcceptPrescription: boolean
}

export interface StoreOrder {
  id: string
  prescriptionId: number
  userName: string
  totalAmount: number
  userStatus: string
  deliveryOption: string
  createdAt: string
}

export interface StoreComplaint {
  id: string
  category: string
  subject: string
  status: string
  priority: string
  createdAt: string
  by: { type: string; id: string; name: string } | null
}

export interface StoreSafetyReport {
  id: string
  reason: string
  status: string
  createdAt: string
  reportedBy: { type: string; id: string; name: string } | null
  reportedAgainst: { type: string; id: string; name: string } | null
}

export interface StorePerformanceMetrics {
  totalOrders: number
  completedOrders: number
  cancellationRate: number
  averageResponseTimeMins: number
  prescriptionAcceptanceRate: number
  complaintCount: number
  refundCount: number
  averageRating: number
}

export interface StoreProfile {
  id: string
  name: string
  ownerName: string
  mobile: string
  email: string
  address: string
  pincode: string
  isActive: boolean
  isVerified: boolean
  autoAcceptPrescription: boolean
  averageRating: number
  totalRatings: number
  avgResponseTimeMins: number
  completedOrdersCount: number
  cancelledOrdersCount: number
  quotesSentCount: number
  ordersWonCount: number
  performanceMetrics: StorePerformanceMetrics
  orders: StoreOrder[]
  prescriptionsReceived: { id: string; prescriptionId: number; userName: string | null; createdAt: string }[]
  quotesSubmitted: StoreOrder[]
  complaints: StoreComplaint[]
  safetyReports: StoreSafetyReport[]
  refunds: UserRefund[]
}

export interface PaginatedResponse<T> {
  results: T[]
  pagination: {
    page: number
    page_size: number
    total_pages: number
    total_count: number
  }
}

export const lookupApi = {
  searchUsers: async (query: string, limit = 20): Promise<PaginatedResponse<UserSearchResult>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<UserSearchResult> }>('/users/search/', { params: { q: query, limit } })
    return response.data.data
  },

  getUserProfile: async (id: string): Promise<UserProfile> => {
    const response = await apiClient.get<{ success: boolean; data: UserProfile }>(`/users/${id}/`)
    return response.data.data
  },

  searchStores: async (query: string, limit = 20): Promise<PaginatedResponse<StoreSearchResult>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<StoreSearchResult> }>('/stores/search/', { params: { q: query, limit } })
    return response.data.data
  },

  getStoreProfile: async (id: string): Promise<StoreProfile> => {
    const response = await apiClient.get<{ success: boolean; data: StoreProfile }>(`/stores/${id}/`)
    return response.data.data
  },
}
