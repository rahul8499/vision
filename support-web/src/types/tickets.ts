export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketType = 'technical' | 'billing' | 'account' | 'general' | 'escalation'
export type TicketChannel = 'email' | 'phone' | 'chat' | 'app' | 'web'

export interface Ticket {
  id: number
  category: string
  categoryDisplay: string
  subject: string
  description: string
  status: TicketStatus
  statusDisplay: string
  priority: TicketPriority
  priorityDisplay: string
  assignedTo?: number
  resolutionNote?: string
  resolvedAt?: string
  messageCount: number
  unreadCount: number
  messages: Array<{
    id: number
    senderType: 'user' | 'store' | 'platform'
    senderName: string
    text: string
    attachment?: string
    isRead: boolean
    createdAt: string
  }>
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: number
  senderId: string
  senderName: string
  senderRole: 'user' | 'support'
  content: string
  attachments: string[]
  isInternal: boolean
  createdAt: string
}

export interface TicketListParams {
  page?: number
  limit?: number
  search?: string
  status?: TicketStatus | ''
  priority?: TicketPriority | ''
  type?: TicketType | ''
  channel?: TicketChannel | ''
  assignedToId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'createdAt' | 'priority' | 'status' | 'slaDeadline'
  sortOrder?: 'asc' | 'desc'
}

export interface TicketCreateRequest {
  userId: string
  subject: string
  description: string
  type: TicketType
  priority?: TicketPriority
  channel: TicketChannel
  tags?: string[]
}

export interface TicketReplyRequest {
  text: string
  attachments?: string[]
  isInternal?: boolean
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  escalated: 'bg-purple-100 text-purple-800',
}

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
