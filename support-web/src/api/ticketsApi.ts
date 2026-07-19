import apiClient from './axios'
import type { PaginatedResponse } from '@/types/auth'
import type { Ticket, TicketListParams, TicketMessage, TicketReplyRequest, TicketStatus } from '@/types/tickets'

type Raw = Record<string, any>
const pick = (raw: Raw, camel: string, snake: string) => raw[camel] ?? raw[snake]
const asText = (raw: Raw, camel: string, snake: string, fallback = '') =>
  String(pick(raw, camel, snake) ?? fallback)

export const normalizeTicketMessage = (raw: Raw): TicketMessage => ({
  id: Number(raw.id),
  senderType: pick(raw, 'senderType', 'sender_type') || 'platform',
  senderName: asText(raw, 'senderName', 'sender_name', raw.sender_type === 'platform' ? 'AARX Support' : 'Requester'),
  text: String(raw.text || ''),
  attachment: raw.attachment || undefined,
  isRead: Boolean(pick(raw, 'isRead', 'is_read')),
  createdAt: asText(raw, 'createdAt', 'created_at'),
})

export const normalizeTicket = (raw: Raw): Ticket => ({
  id: Number(raw.id),
  scope: raw.scope || 'GLOBAL',
  cityId: pick(raw, 'cityId', 'city') ?? undefined,
  cityName: pick(raw, 'cityName', 'city_name') || undefined,
  category: raw.category || 'other',
  categoryDisplay: asText(raw, 'categoryDisplay', 'category_display', String(raw.category || 'Other').replace(/_/g, ' ')),
  subject: String(raw.subject || 'Untitled support request'),
  description: String(raw.description || ''),
  requesterType: pick(raw, 'requesterType', 'requester_type') || 'user',
  requesterName: asText(raw, 'requesterName', 'requester_name', 'Unknown requester'),
  status: raw.status || 'open',
  statusDisplay: asText(raw, 'statusDisplay', 'status_display', String(raw.status || 'open').replace(/_/g, ' ')),
  priority: raw.priority || 'medium',
  priorityDisplay: asText(raw, 'priorityDisplay', 'priority_display', raw.priority || 'Medium'),
  assignedTo: pick(raw, 'assignedTo', 'assigned_to') || undefined,
  assignedToName: pick(raw, 'assignedToName', 'assigned_to_name') || undefined,
  resolutionNote: pick(raw, 'resolutionNote', 'resolution_note') || undefined,
  resolvedAt: pick(raw, 'resolvedAt', 'resolved_at') || undefined,
  messageCount: Number(pick(raw, 'messageCount', 'message_count') || raw.messages?.length || 0),
  unreadCount: Number(pick(raw, 'unreadCount', 'unread_count') || 0),
  messages: (raw.messages || []).map(normalizeTicketMessage),
  createdAt: asText(raw, 'createdAt', 'created_at'),
  updatedAt: asText(raw, 'updatedAt', 'updated_at'),
})

export const ticketsApi = {
  getAll: async (params?: TicketListParams): Promise<PaginatedResponse<Ticket>> => {
    const response = await apiClient.get('/tickets/', {
      params: {
        page: params?.page,
        page_size: params?.limit,
        q: params?.search,
        status: params?.status,
        priority: params?.priority,
        category: params?.category,
        city: params?.city,
      },
    })
    const data = response.data.data
    return { ...data, results: (data.results || []).map(normalizeTicket) }
  },
  getOne: async (id: string): Promise<Ticket> => {
    const response = await apiClient.get(`/tickets/${id}/`)
    return normalizeTicket(response.data.data)
  },
  reply: async (id: string, data: TicketReplyRequest): Promise<TicketMessage> => {
    const response = await apiClient.post(`/tickets/${id}/reply/`, data)
    return normalizeTicketMessage(response.data.data)
  },
  updateStatus: async (id: string, status: TicketStatus, resolutionNote?: string): Promise<Partial<Ticket>> => {
    const response = await apiClient.post(`/tickets/${id}/status/`, {
      status,
      resolution_note: resolutionNote,
    })
    const raw = response.data.data
    return {
      status: raw.status,
      statusDisplay: raw.status_display,
      resolutionNote: raw.resolution_note || undefined,
      resolvedAt: raw.resolved_at || undefined,
      updatedAt: raw.updated_at,
    }
  },
  assign: async (id: string, agentId: string): Promise<void> => {
    await apiClient.post(`/tickets/${id}/assign/`, { assigned_to: agentId })
  },
}
