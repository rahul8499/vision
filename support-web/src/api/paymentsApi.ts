import apiClient from './axios'
import type { PaymentListParams, PaymentPage, PaymentRecord } from '@/types/payments'

type Raw = Record<string, unknown>

const normalizePayment = (raw: Raw): PaymentRecord => ({
  id: String(raw.id),
  source: raw.source as PaymentRecord['source'],
  sourceDisplay: String(raw.source_display || ''),
  customerType: raw.customer_type as PaymentRecord['customerType'],
  customerId: Number(raw.customer_id),
  customerName: String(raw.customer_name || ''),
  paymentId: String(raw.payment_id || ''),
  orderId: String(raw.order_id || ''),
  amount: Number(raw.amount || 0),
  currency: String(raw.currency || 'INR'),
  status: String(raw.status || 'unknown'),
  operationalStatus: String(raw.operational_status || ''),
  operationalStatusDisplay: String(raw.operational_status_display || ''),
  referenceId: String(raw.reference_id || ''),
  refundId: String(raw.refund_id || ''),
  createdAt: String(raw.created_at || ''),
  updatedAt: String(raw.updated_at || ''),
})

export const paymentsApi = {
  getAll: async (params: PaymentListParams): Promise<PaymentPage> => {
    const response = await apiClient.get('/payments/', {
      params: {
        page: params.page,
        page_size: params.pageSize,
        search: params.search,
        source: params.source,
        status: params.status,
        date_from: params.dateFrom,
        date_to: params.dateTo,
      },
    })
    const raw = response.data.data
    return {
      results: (raw.results as Raw[]).map(normalizePayment),
      pagination: {
        page: Number(raw.pagination.page),
        pageSize: Number(raw.pagination.page_size),
        totalPages: Number(raw.pagination.total_pages),
        totalCount: Number(raw.pagination.total_count),
      },
      summary: {
        totalPayments: Number(raw.summary.total_payments),
        broadcasting: Number(raw.summary.broadcasting),
        serviceDelivered: Number(raw.summary.service_delivered),
        refundPending: Number(raw.summary.refund_pending),
        refundFailed: Number(raw.summary.refund_failed),
      },
    }
  },
}
