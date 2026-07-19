import apiClient from './axios'

type Raw = Record<string, any>
const list = (value: unknown): Raw[] => Array.isArray(value) ? value : []
const party = (value: Raw | null | undefined) => value ? {
  type: String(value.type), id: String(value.id), name: String(value.name || 'Unknown'),
} : null

const normalizeSearchUser = (raw: Raw): UserSearchResult => ({
  id: String(raw.id), name: raw.name || 'Unnamed user', email: raw.email || '', mobile: raw.mobile || '',
  isActive: raw.is_active ?? false, isVerified: raw.is_verified ?? false,
})
const normalizeSearchStore = (raw: Raw): StoreSearchResult => ({
  id: String(raw.id), name: raw.name || 'Unnamed pharmacy', ownerName: raw.owner_name || '',
  mobile: raw.mobile || '', email: raw.email || '', address: raw.address || '', pincode: raw.pincode || '',
  isActive: raw.is_active ?? false, isVerified: raw.is_verified ?? false,
  averageRating: Number(raw.average_rating || 0), totalRatings: Number(raw.total_ratings || 0),
  autoAcceptPrescription: raw.auto_accept_prescription ?? false,
})
const normalizeOrder = (raw: Raw): UserOrder => ({
  id: String(raw.id), prescriptionId: Number(raw.prescription_id || 0), storeName: raw.store_name || '',
  totalAmount: Number(raw.total_amount || 0), userStatus: raw.user_status || 'unknown',
  deliveryOption: raw.delivery_option || '', createdAt: raw.created_at || '',
})
const normalizeRefund = (raw: Raw): UserRefund => ({
  id: String(raw.id), amount: Number(raw.amount || 0), status: raw.status || 'unknown', reason: raw.reason || '',
  createdAt: raw.created_at || '', processedAt: raw.processed_at || null,
})
const normalizeSafety = (raw: Raw): UserSafetyReport => ({
  id: String(raw.id), reason: raw.reason || raw.description || raw.category || 'Safety report',
  status: raw.status || 'submitted', createdAt: raw.created_at || '',
  reportedBy: party(raw.reported_by), reportedAgainst: party(raw.reported_against),
})

const normalizeUserProfile = (raw: Raw): UserProfile => ({
  id: String(raw.id), name: raw.name || 'Unnamed user', mobile: raw.mobile || '', email: raw.email || '',
  address: raw.address || '', pincode: raw.pincode || '', isActive: raw.is_active ?? false,
  isVerified: raw.is_verified ?? false, isDeleted: raw.is_deleted ?? false,
  preferredLanguage: raw.preferred_language || 'en',
  orders: list(raw.orders).map(normalizeOrder),
  prescriptions: list(raw.prescriptions).map((item) => ({
    id: Number(item.id), medicineName: item.medicine_name || '', description: item.description || '',
    createdAt: item.created_at || '', targetStores: list(item.target_stores).map((store) => ({ id: String(store.id), name: store.name || '' })),
  })),
  complaints: list(raw.complaints).map((item) => ({
    id: String(item.id), category: item.category || '', subject: item.subject || '', status: item.status || '',
    priority: item.priority || '', createdAt: item.created_at || '', against: party(item.against),
  })),
  tickets: list(raw.tickets).map((item) => ({
    id: String(item.id), category: item.category || '', subject: item.subject || '', status: item.status || '',
    priority: item.priority || '', createdAt: item.created_at || '', updatedAt: item.updated_at || item.created_at || '',
  })),
  refunds: list(raw.refunds).map(normalizeRefund),
  safetyReportsFiled: list(raw.safety_reports_filed).map(normalizeSafety),
  safetyReportsAgainst: list(raw.safety_reports_against).map(normalizeSafety),
})

const normalizeStoreOrder = (raw: Raw): StoreOrder => ({
  id: String(raw.id), prescriptionId: Number(raw.prescription_id || 0), userName: raw.user_name || 'Unknown user',
  totalAmount: Number(raw.total_amount || 0), userStatus: raw.user_status || 'unknown',
  deliveryOption: raw.delivery_option || '', createdAt: raw.created_at || '',
})
const normalizeStoreProfile = (raw: Raw): StoreProfile => {
  const metrics = raw.performance_metrics || {}
  return {
    ...normalizeSearchStore(raw),
    avgResponseTimeMins: Number(raw.avg_response_time_mins || 0),
    completedOrdersCount: Number(raw.completed_orders_count || 0), cancelledOrdersCount: Number(raw.cancelled_orders_count || 0),
    quotesSentCount: Number(raw.quotes_sent_count || 0), ordersWonCount: Number(raw.orders_won_count || 0),
    performanceMetrics: {
      totalOrders: Number(metrics.total_orders || 0), completedOrders: Number(metrics.completed_orders || 0),
      cancellationRate: Number(metrics.cancellation_rate || 0), averageResponseTimeMins: Number(metrics.average_response_time_mins || 0),
      prescriptionAcceptanceRate: Number(metrics.prescription_acceptance_rate || 0), complaintCount: Number(metrics.complaint_count || 0),
      refundCount: Number(metrics.refund_count || 0), averageRating: Number(metrics.average_rating || 0),
    },
    orders: list(raw.orders).map(normalizeStoreOrder),
    prescriptionsReceived: list(raw.prescriptions_received).map((item) => ({ id: String(item.id), prescriptionId: Number(item.prescription_id), userName: item.user_name || null, createdAt: item.created_at || '' })),
    quotesSubmitted: list(raw.quotes_submitted).map(normalizeStoreOrder),
    complaints: list(raw.complaints).map((item) => ({ id: String(item.id), category: item.category || '', subject: item.subject || '', status: item.status || '', priority: item.priority || '', createdAt: item.created_at || '', by: party(item.by) })),
    safetyReports: list(raw.safety_reports).map(normalizeSafety), refunds: list(raw.refunds).map(normalizeRefund),
  }
}

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
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Raw> }>('/users/search/', { params: { q: query, page_size: limit } })
    return { ...response.data.data, results: list(response.data.data.results).map(normalizeSearchUser) }
  },

  getUserProfile: async (id: string): Promise<UserProfile> => {
    const response = await apiClient.get<{ success: boolean; data: Raw }>(`/users/${id}/`)
    return normalizeUserProfile(response.data.data)
  },

  searchStores: async (query: string, limit = 20): Promise<PaginatedResponse<StoreSearchResult>> => {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Raw> }>('/stores/search/', { params: { q: query, page_size: limit } })
    return { ...response.data.data, results: list(response.data.data.results).map(normalizeSearchStore) }
  },

  getStoreProfile: async (id: string): Promise<StoreProfile> => {
    const response = await apiClient.get<{ success: boolean; data: Raw }>(`/stores/${id}/`)
    return normalizeStoreProfile(response.data.data)
  },
}
