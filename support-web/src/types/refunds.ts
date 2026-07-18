export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed' | 'failed' | 'cancelled'
export type RefundType = 'order_refund' | 'partial_refund' | 'tip_refund' | 'fee_refund' | 'compensation'

export interface Refund {
  id: string | number
  cityId?: number
  cityName?: string
  charge: string
  source: 'support_request' | 'emergency_broadcast'
  sourceDisplay: string
  isActionable: boolean
  currency: string
  prescriptionResponse?: number
  requestedById: number
  requestedByName: string
  assignedToId?: number
  assignedToName?: string
  reviewedById?: number
  reviewedByName?: string
  status: RefundStatus
  amount: number
  reason: string
  rejectionReason?: string
  paymentGateway?: string
  paymentReference?: string
  processedAt?: string
  approvedAt?: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RefundListParams {
  page?: number
  limit?: number
  search?: string
  status?: RefundStatus | ''
  type?: RefundType | ''
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  sortBy?: 'createdAt' | 'amount' | 'status'
  sortOrder?: 'asc' | 'desc'
  city?: string
}

export interface RefundApproveRequest {
  notes?: string
}

export interface RefundRejectRequest {
  reason: string
}

export interface RefundProcessRequest {
  transactionId: string
  paymentMethod: string
}

export const REFUND_STATUS_COLORS: Record<RefundStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  processed: 'success',
  failed: 'danger',
  cancelled: 'default',
}

export const REFUND_TYPE_LABELS: Record<RefundType, string> = {
  order_refund: 'Order Refund',
  partial_refund: 'Partial Refund',
  tip_refund: 'Tip Refund',
  fee_refund: 'Fee Refund',
  compensation: 'Compensation',
}
