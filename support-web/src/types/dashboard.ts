export interface DashboardStats {
  totalComplaints: number
  openComplaints: number
  resolvedComplaints: number
  avgResolutionTimeHours: number | null
  totalTickets: number
  openTickets: number
  avgTicketResponseTimeMinutes: number | null
  totalRefunds: number
  pendingRefunds: number
  refundApprovalRate: number | null
  totalRefundAmount: number
  totalSafetyReports: number
  openSafetyReports: number
  criticalSafetyReports: number
  agentPerformance: AgentPerformance[]
  complaintTrend: TrendPoint[]
  ticketTrend: TrendPoint[]
  refundTrend: TrendPoint[]
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  ticketsResolved: number
  avgResponseTimeMinutes: number
  satisfactionScore: number | null
  complaintsResolved: number
}

export interface TrendPoint {
  date: string
  count: number
}
