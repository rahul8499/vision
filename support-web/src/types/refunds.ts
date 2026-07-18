export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed' | 'failed' | 'cancelled'
export type RefundType = 'order_refund' | 'partial_refund' | 'tip_refund' | 'fee_refund' | 'compensation'

export interface Refund {
  id: number
  charge: string
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

export const REFUND_STATUS_COLORS: Record<RefundStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export const REFUND_TYPE_LABELS: Record<RefundType, string> = {
  order_refund: 'Order Refund',
  partial_refund: 'Partial Refund',
  tip_refund: 'Tip Refund',
  fee_refund: 'Fee Refund',
  compensation: 'Compensation',
}
