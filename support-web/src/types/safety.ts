export type SafetyReportStatus = 'submitted' | 'under_review' | 'action_taken' | 'closed' | 'escalated'
export type SafetyReportSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SafetyReportCategory = 'fake_or_spam' | 'invalid_contact' | 'wrong_information' | 'suspicious_behavior' | 'medicine_safety' | 'abusive_behavior' | 'other'
export type ReporterType = 'user' | 'store'
export type TargetType = 'user' | 'store'

export interface SafetyReport {
  id: number
  reporterType: ReporterType
  reporterName: string
  targetType: TargetType
  reportedName: string
  category: SafetyReportCategory
  description: string
  status: SafetyReportStatus
  resolutionNote?: string
  prescriptionId?: number
  responseId?: number
  assignedToName?: string
  actionHistory: SafetyReportAction[]
  internalNotes: InternalNote[]
  createdAt: string
  updatedAt: string
}

export interface SafetyReportAction {
  id: number
  action: string
  adminName: string
  note: string
  targetUserId?: number
  targetStoreId?: number
  createdAt: string
}

export interface SafetyReportListParams {
  page?: number
  limit?: number
  search?: string
  status?: SafetyReportStatus | ''
  category?: SafetyReportCategory | ''
  dateFrom?: string
  dateTo?: string
  sortBy?: 'createdAt' | 'severity' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export const SAFETY_REPORT_STATUS_COLORS: Record<SafetyReportStatus, string> = {
  submitted: 'bg-gray-100 text-gray-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  action_taken: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  escalated: 'bg-purple-100 text-purple-800',
}

export const SAFETY_REPORT_SEVERITY_COLORS: Record<SafetyReportSeverity, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
