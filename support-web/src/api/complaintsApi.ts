import apiClient from './axios'
import type {
  Complaint,
  ComplaintListParams,
  ComplaintCreateRequest,
  ComplaintUpdateRequest,
  ComplaintReplyRequest,
  ComplaintMessage,
  InternalNote,
} from '@/types/complaints'
import type { PaginatedResponse } from '@/types/auth'

type Raw = Record<string, any>
const value = (data: Raw, camel: string, snake: string) => data[camel] ?? data[snake]
const text = (data: Raw, camel: string, snake: string, fallback = '') =>
  String(value(data, camel, snake) ?? fallback)

export const normalizeComplaintMessage = (raw: Raw): ComplaintMessage => ({
  id: Number(raw.id),
  senderType: value(raw, 'senderType', 'sender_type') || 'platform',
  senderName: text(raw, 'senderName', 'sender_name', 'Unknown sender'),
  visibility: raw.visibility || 'SHARED',
  text: String(raw.text ?? ''),
  attachmentUrl: value(raw, 'attachmentUrl', 'attachment_url') || undefined,
  isRead: Boolean(value(raw, 'isRead', 'is_read')),
  createdAt: text(raw, 'createdAt', 'created_at'),
})

export const normalizeComplaint = (raw: Raw): Complaint => ({
  id: Number(raw.id),
  scope: value(raw, 'scope', 'scope') || 'CITY',
  cityId: value(raw, 'cityId', 'city') ?? undefined,
  cityName: value(raw, 'cityName', 'city_name') || undefined,
  category: raw.category || 'other',
  categoryDisplay: text(raw, 'categoryDisplay', 'category_display', String(raw.category || 'Other').replace(/_/g, ' ')),
  subject: String(raw.subject || 'Untitled complaint'),
  description: raw.description || undefined,
  status: raw.status || 'open',
  statusDisplay: text(raw, 'statusDisplay', 'status_display', String(raw.status || 'open').replace(/_/g, ' ')),
  priority: raw.priority || 'medium',
  priorityDisplay: text(raw, 'priorityDisplay', 'priority_display', String(raw.priority || 'medium')),
  complainantType: value(raw, 'complainantType', 'complainant_type') || 'user',
  complainantName: text(raw, 'complainantName', 'complainant_name', 'Unknown complainant'),
  respondentType: value(raw, 'respondentType', 'respondent_type') || 'store',
  respondentName: text(raw, 'respondentName', 'respondent_name', 'Unknown respondent'),
  orderId: value(raw, 'orderId', 'order_id') ?? undefined,
  assignedTo: value(raw, 'assignedTo', 'assigned_to') ?? undefined,
  resolutionNotes: value(raw, 'resolutionNotes', 'resolution_notes') || undefined,
  resolvedAt: value(raw, 'resolvedAt', 'resolved_at') || undefined,
  unreadCount: Number(value(raw, 'unreadCount', 'unread_count') || 0),
  messageCount: Number(value(raw, 'messageCount', 'message_count') || raw.messages?.length || 0),
  attachmentCount: Number(value(raw, 'attachmentCount', 'attachment_count') || raw.attachments?.length || 0),
  attachments: (raw.attachments || []).map((a: Raw) => ({
    id: Number(a.id),
    url: String(a.url || ''),
    createdAt: text(a, 'createdAt', 'created_at'),
  })),
  messages: (raw.messages || []).map(normalizeComplaintMessage),
  statusHistory: (value(raw, 'statusHistory', 'status_history') || []).map((event: Raw) => ({
    id: Number(event.id),
    fromStatus: text(event, 'fromStatus', 'from_status'),
    toStatus: text(event, 'toStatus', 'to_status'),
    changedBy: value(event, 'changedBy', 'changed_by'),
    note: event.note || undefined,
    createdAt: text(event, 'createdAt', 'created_at'),
  })),
  canWithdraw: Boolean(value(raw, 'canWithdraw', 'can_withdraw')),
  createdAt: text(raw, 'createdAt', 'created_at'),
  updatedAt: text(raw, 'updatedAt', 'updated_at'),
})

const normalizeNote = (raw: Raw): InternalNote => ({
  id: Number(raw.id),
  content: String(raw.content ?? raw.body ?? ''),
  authorName: text(raw, 'authorName', 'created_by_name', 'Support team'),
  createdAt: text(raw, 'createdAt', 'created_at'),
  isPinned: Boolean(value(raw, 'isPinned', 'is_pinned')),
})

export const complaintsApi = {
  getAll: async (params?: ComplaintListParams): Promise<PaginatedResponse<Complaint>> => {
    const response = await apiClient.get('/complaints/', {
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
    return { ...data, results: (data.results || []).map(normalizeComplaint) }
  },
  getOne: async (id: string): Promise<Complaint> => {
    const response = await apiClient.get(`/complaints/${id}/`)
    return normalizeComplaint(response.data.data)
  },
  getInternalNotes: async (id: string): Promise<InternalNote[]> => {
    const response = await apiClient.get(`/complaints/${id}/notes/`)
    return (response.data.data?.results || []).map(normalizeNote)
  },
  create: async (data: ComplaintCreateRequest): Promise<Complaint> => {
    const response = await apiClient.post('/complaints/', data)
    return normalizeComplaint(response.data.data)
  },
  updateStatus: async (id: string, status: string, note?: string): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/status/`, { status, note })
    return normalizeComplaint(response.data.data)
  },
  update: async (id: string, data: ComplaintUpdateRequest): Promise<Complaint> => {
    if (data.status) return complaintsApi.updateStatus(id, data.status)
    throw new Error('This complaint update is not supported by the API.')
  },
  reply: async (id: string, data: ComplaintReplyRequest): Promise<ComplaintMessage> => {
    const response = await apiClient.post(`/complaints/${id}/reply/`, data)
    return normalizeComplaintMessage(response.data.data)
  },
  addInternalNote: async (id: string, body: string): Promise<InternalNote> => {
    const response = await apiClient.post(`/complaints/${id}/notes/`, { body })
    return normalizeNote(response.data.data)
  },
  assign: async (id: string, agentId: string): Promise<void> => {
    await apiClient.post(`/complaints/${id}/assign/`, { assigned_to: agentId })
  },
  bulkAssign: async (ids: string[], agentId: string): Promise<unknown> => {
    const response = await apiClient.post('/complaints/bulk-assign/', { complaint_ids: ids, assigned_to: agentId })
    return response.data.data
  },
  bulkClose: async (ids: string[]): Promise<unknown> => {
    const response = await apiClient.post('/complaints/bulk-close/', { complaint_ids: ids })
    return response.data.data
  },
}
