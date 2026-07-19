import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { uploadFileToS3 } from './s3Upload';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

export type ComplaintParty = 'user' | 'store';
export type ComplaintStatus =
  | 'open'
  | 'under_review'
  | 'awaiting_info'
  | 'resolved'
  | 'rejected'
  | 'withdrawn'
  | 'closed';

export const COMPLAINT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'wrong_or_expired_medicine', label: 'Wrong / Expired Medicine' },
  { value: 'overcharging', label: 'Overcharging / Billing' },
  { value: 'rude_behavior', label: 'Rude Behavior' },
  { value: 'fake_order', label: 'Fake / Spam Order' },
  { value: 'non_delivery', label: 'Non-Delivery' },
  { value: 'product_quality', label: 'Product Quality' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'other', label: 'Other' },
];

export const COMPLAINT_PRIORITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export type ComplaintSummary = {
  id: number;
  category: string;
  category_display: string;
  subject: string;
  status: ComplaintStatus;
  status_display: string;
  priority: string;
  priority_display: string;
  complainant_type: ComplaintParty;
  complainant_name: string;
  respondent_type: ComplaintParty;
  respondent_name: string;
  order_id: number | null;
  created_at: string;
  updated_at: string;
  unread_count: number;
  message_count: number;
  attachment_count: number;
};

export type ComplaintMessage = {
  id: number;
  sender_type: 'user' | 'store' | 'platform';
  sender_name: string;
  visibility: 'USER_SUPPORT' | 'STORE_SUPPORT' | 'SHARED' | 'INTERNAL';
  text: string | null;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
};

export type ComplaintAttachment = {
  id: number;
  url: string | null;
  created_at: string;
};

export type ComplaintStatusHistoryEntry = {
  id: number;
  from_status: string;
  to_status: string;
  changed_by: string;
  note: string | null;
  created_at: string;
};

export type ComplaintDetail = ComplaintSummary & {
  description: string;
  attachments: ComplaintAttachment[];
  messages: ComplaintMessage[];
  status_history: ComplaintStatusHistoryEntry[];
  can_withdraw: boolean;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  support_rating: SupportRating | null;
};

export type SupportRating = { rating: number; feedback: string; created_at: string; updated_at?: string };

export type LocalAttachment = { uri: string; name: string; type: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('authToken');
  return { Authorization: `Bearer ${token || ''}` };
}

export async function getComplaintCounts(): Promise<{ filed: number; against: number; open_against: number }> {
  const h = await authHeaders();
  const res = await axios.get(`${BASE_URL}/api/complaints/counts/`, { headers: h });
  return res.data;
}

export async function getMyComplaints(): Promise<ComplaintSummary[]> {
  const h = await authHeaders();
  const res = await axios.get(`${BASE_URL}/api/complaints/my/`, { headers: h });
  return res.data;
}

export async function getComplaintsAgainstMe(): Promise<ComplaintSummary[]> {
  const h = await authHeaders();
  const res = await axios.get(`${BASE_URL}/api/complaints/against/`, { headers: h });
  return res.data;
}

export async function getComplaintDetail(id: number): Promise<ComplaintDetail> {
  const h = await authHeaders();
  const res = await axios.get(`${BASE_URL}/api/complaints/${id}/`, { headers: h });
  return res.data;
}

export type CreateComplaintPayload = {
  respondent_type: ComplaintParty;
  respondent_id: number;
  category: string;
  subject: string;
  description: string;
  priority?: string;
  order_id?: number | null;
  attachments?: LocalAttachment[];
};

export async function createComplaint(payload: CreateComplaintPayload): Promise<ComplaintDetail> {
  const token = await SecureStore.getItemAsync('authToken');
  const formData = new FormData();
  formData.append('respondent_type', payload.respondent_type);
  formData.append('respondent_id', String(payload.respondent_id));
  formData.append('category', payload.category);
  formData.append('subject', payload.subject);
  formData.append('description', payload.description);
  if (payload.priority) formData.append('priority', payload.priority);
  if (payload.order_id) formData.append('order_id', String(payload.order_id));
  for (const attachment of payload.attachments || []) {
    const key = await uploadFileToS3(attachment, 'complaints', token || '');
    formData.append('attachment_keys', key);
  }

  const res = await fetch(`${BASE_URL}/api/complaints/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as ComplaintDetail;
}

export async function addComplaintMessage(
  id: number,
  opts: { text?: string; attachment?: LocalAttachment | null }
): Promise<ComplaintMessage> {
  const token = await SecureStore.getItemAsync('authToken');
  const formData = new FormData();
  if (opts.text) formData.append('text', opts.text);
  if (opts.attachment) {
    const key = await uploadFileToS3(opts.attachment, 'complaints', token || '');
    formData.append('attachment_key', key);
  }
  const res = await fetch(`${BASE_URL}/api/complaints/${id}/messages/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as ComplaintMessage;
}

export async function withdrawComplaint(id: number, reason?: string): Promise<ComplaintDetail> {
  const h = await authHeaders();
  const res = await axios.post(
    `${BASE_URL}/api/complaints/${id}/withdraw/`,
    { reason: reason || '' },
    { headers: h }
  );
  return res.data;
}

export async function rateComplaint(id: number, rating: number, feedback: string): Promise<SupportRating> {
  const h = await authHeaders();
  const res = await axios.post(`${BASE_URL}/api/complaints/${id}/rating/`, { rating, feedback }, { headers: h });
  return res.data;
}
