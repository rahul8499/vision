export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketCategory = 'app_bug' | 'account' | 'verification' | 'subscription' | 'technical' | 'feature' | 'other'

export interface TicketMessage {
  id: number
  senderType: 'user' | 'store' | 'platform'
  senderName: string
  text: string
  attachment?: string
  isRead: boolean
  createdAt: string
}

export interface Ticket {
  id: number
  scope: 'CITY' | 'GLOBAL'
  cityId?: number
  cityName?: string
  category: TicketCategory
  categoryDisplay: string
  subject: string
  description: string
  requesterType: 'user' | 'store'
  requesterId?: number
  requesterName: string
  status: TicketStatus
  statusDisplay: string
  priority: TicketPriority
  priorityDisplay: string
  assignedTo?: string
  assignedToName?: string
  resolutionNote?: string
  resolvedAt?: string
  messageCount: number
  unreadCount: number
  messages: TicketMessage[]
  supportRating?: { rating: number; feedback?: string; createdAt?: string }
  createdAt: string
  updatedAt: string
}

export interface TicketListParams {
  page?: number
  limit?: number
  search?: string
  status?: TicketStatus | ''
  priority?: TicketPriority | ''
  category?: TicketCategory | ''
  city?: string
}

export interface TicketReplyRequest {
  text: string
  attachment?: File
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  waiting_for_user: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  closed: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
}

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  medium: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  urgent: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}
