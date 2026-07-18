export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated' | 'under_review' | 'awaiting_info'
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical'
export type ComplaintCategory = 'food_quality' | 'delivery' | 'app_issue' | 'billing' | 'other'
export type ComplaintSource = 'app' | 'call_center' | 'email' | 'social_media'
export type ComplainantType = 'user' | 'store'
export type RespondentType = 'user' | 'store'

export interface Complaint {
  id: number
  category: string
  categoryDisplay: string
  subject: string
  description?: string
  status: ComplaintStatus
  statusDisplay: string
  priority: ComplaintPriority
  priorityDisplay: string
  complainantType: ComplainantType
  complainantName: string
  respondentType: RespondentType
  respondentName: string
  orderId?: number
  assignedTo?: number
  resolutionNotes?: string
  resolvedAt?: string
  unreadCount: number
  messageCount: number
  attachmentCount: number
  attachments?: Array<{ id: number; url: string; filename?: string; uploaded_at: string }>
  messages?: Array<{
    id: number
    senderType: 'user' | 'store' | 'platform'
    senderUserId?: number
    senderStoreId?: number
    senderName: string
    text: string
    attachmentUrl?: string
    isRead: boolean
    createdAt: string
  }>
  statusHistory?: Array<{
    id: number
    fromStatus: string
    toStatus: string
    changedBy?: string
    note?: string
    createdAt: string
  }>
  canWithdraw: boolean
  internalNotes?: Array<{
    id: number
    content: string
    authorName: string
    createdAt: string
  }>
  createdAt: string
  updatedAt: string
}

export interface ComplaintMessage {
  id: number
  senderId: string
  senderName: string
  senderRole: 'user' | 'support'
  content: string
  attachments: string[]
  createdAt: string
}

export interface InternalNote {
  id: number
  authorId: string
  authorName: string
  content: string
  createdAt: string
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
}

export interface ComplaintCreateRequest {
  respondentType: 'user' | 'store'
  respondentId: number
  category: ComplaintCategory
  subject: string
  description: string
  priority?: ComplaintPriority
  orderId?: number
}

export interface ComplaintReplyRequest {
  text: string
  attachments?: string[]
}

export interface ComplaintUpdateRequest {
  status?: ComplaintStatus
  priority?: ComplaintPriority
  assignedToId?: string
  tags?: string[]
}

export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  escalated: 'bg-purple-100 text-purple-800',
  under_review: 'bg-blue-100 text-blue-800',
  awaiting_info: 'bg-orange-100 text-orange-800',
}

export const COMPLAINT_PRIORITY_COLORS: Record<ComplaintPriority, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
