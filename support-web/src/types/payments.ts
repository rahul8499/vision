export type PaymentSource = 'emergency_broadcast' | 'store_subscription'

export interface PaymentRecord {
  id: string
  source: PaymentSource
  sourceDisplay: string
  customerType: 'user' | 'store'
  customerId: number
  customerName: string
  paymentId: string
  orderId: string
  amount: number
  currency: string
  status: string
  operationalStatus: string
  operationalStatusDisplay: string
  referenceId: string
  refundId: string
  createdAt: string
  updatedAt: string
}

export interface PaymentSummary {
  totalPayments: number
  broadcasting: number
  serviceDelivered: number
  refundPending: number
  refundFailed: number
}

export interface PaymentListParams {
  page?: number
  pageSize?: number
  search?: string
  source?: PaymentSource | ''
  status?: string
  dateFrom?: string
  dateTo?: string
}

export interface PaymentPage {
  results: PaymentRecord[]
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
  summary: PaymentSummary
}
