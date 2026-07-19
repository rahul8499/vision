export type SafetyReportStatus = 'submitted' | 'under_review' | 'action_taken' | 'escalated' | 'closed'
export type SafetyReportSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SafetyReportCategory = 'fake_or_spam' | 'invalid_contact' | 'wrong_information' | 'suspicious_behavior' | 'medicine_safety' | 'abusive_behavior' | 'other'
export type ReporterType = 'user' | 'store'
export type TargetType = 'user' | 'store'
export type SafetyScope = 'CITY' | 'GLOBAL'
export type SafetyAction = 'reviewed' | 'warning_sent' | 'account_suspended' | 'account_restored' | 'escalated' | 'closed'

export interface SafetyInternalNote {
  id: number
  body: string
  createdByName: string
  isPinned: boolean
  createdAt: string
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

export interface SafetyReport {
  id: number
  reporterType: ReporterType
  reporterName: string
  targetType: TargetType
  reportedName: string
  reportedUserId?: number
  reportedStoreId?: number
  category: SafetyReportCategory
  severity: SafetyReportSeverity
  scope: SafetyScope
  cityId?: number
  cityName?: string
  description: string
  status: SafetyReportStatus
  resolutionNote?: string
  prescriptionId?: number
  responseId?: number
  assignedToId?: number
  assignedToName?: string
  actionHistory: SafetyReportAction[]
  internalNotes: SafetyInternalNote[]
  createdAt: string
  updatedAt: string
}

export interface SafetyReportListParams {
  page?: number
  limit?: number
  search?: string
  status?: SafetyReportStatus | ''
  severity?: SafetyReportSeverity | ''
  category?: SafetyReportCategory | ''
  reporterType?: ReporterType | ''
  targetType?: TargetType | ''
  scope?: SafetyScope | ''
  assignedTo?: string
  city?: string
  dateFrom?: string
  dateTo?: string
}

export const SAFETY_REPORT_STATUS_COLORS: Record<SafetyReportStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-800',
  action_taken: 'bg-blue-100 text-blue-800',
  escalated: 'bg-purple-100 text-purple-800',
  closed: 'bg-emerald-100 text-emerald-800',
}

export const SAFETY_REPORT_SEVERITY_COLORS: Record<SafetyReportSeverity, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
