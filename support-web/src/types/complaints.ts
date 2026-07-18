export type ComplaintStatus = 'open' | 'under_review' | 'awaiting_info' | 'resolved' | 'rejected' | 'withdrawn' | 'closed'
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ComplaintCategory =
  | 'delivery_issue'
  | 'wrong_or_expired_medicine'
  | 'overcharging'
  | 'rude_behavior'
  | 'fake_order'
  | 'non_delivery'
  | 'product_quality'
  | 'payment_issue'
  | 'other'
export type PartyType = 'user' | 'store'
export type ComplaintMessageVisibility = 'USER_SUPPORT' | 'STORE_SUPPORT' | 'SHARED' | 'INTERNAL'

export interface ComplaintAttachment {
  id: number
  url: string
  createdAt: string
}

export interface ComplaintMessage {
  id: number
  senderType: 'user' | 'store' | 'platform'
  senderName: string
  visibility: ComplaintMessageVisibility
  text: string
  attachmentUrl?: string
  isRead: boolean
  createdAt: string
}

export interface ComplaintStatusEvent {
  id: number
  fromStatus: string
  toStatus: string
  changedBy?: string
  note?: string
  createdAt: string
}

export interface InternalNote {
  id: number
  content: string
  authorName: string
  createdAt: string
  isPinned?: boolean
}

export interface Complaint {
  id: number
  scope: 'CITY' | 'GLOBAL'
  cityId?: number
  cityName?: string
  category: ComplaintCategory
  categoryDisplay: string
  subject: string
  description?: string
  status: ComplaintStatus
  statusDisplay: string
  priority: ComplaintPriority
  priorityDisplay: string
  complainantType: PartyType
  complainantName: string
  respondentType: PartyType
  respondentName: string
  orderId?: number
  assignedTo?: string
  resolutionNotes?: string
  resolvedAt?: string
  unreadCount: number
  messageCount: number
  attachmentCount: number
  attachments: ComplaintAttachment[]
  messages: ComplaintMessage[]
  statusHistory: ComplaintStatusEvent[]
  canWithdraw: boolean
  createdAt: string
  updatedAt: string
}

export interface ComplaintListParams {
  page?: number
  limit?: number
  search?: string
  status?: ComplaintStatus | ''
  priority?: ComplaintPriority | ''
  category?: ComplaintCategory | ''
  assignedToId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'createdAt' | 'priority' | 'status'
  sortOrder?: 'asc' | 'desc'
  city?: string
}

export interface ComplaintCreateRequest {
  respondentType: PartyType
  respondentId: number
  category: ComplaintCategory
  subject: string
  description: string
  priority?: ComplaintPriority
  orderId?: number
}

export interface ComplaintReplyRequest {
  text: string
  visibility: ComplaintMessageVisibility
  attachments?: string[]
}

export interface ComplaintUpdateRequest {
  status?: ComplaintStatus
  priority?: ComplaintPriority
  assignedToId?: string
}

export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  open: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
  under_review: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  awaiting_info: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  rejected: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  withdrawn: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
  closed: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
}

export const COMPLAINT_PRIORITY_COLORS: Record<ComplaintPriority, string> = {
  low: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  medium: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  urgent: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}
