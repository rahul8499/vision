export interface DashboardStats {
  totalComplaints: number
  openComplaints: number
  resolvedComplaints: number
  avgResolutionTimeHours: number
  totalTickets: number
  openTickets: number
  avgTicketResponseTimeMinutes: number
  totalRefunds: number
  pendingRefunds: number
  refundApprovalRate: number
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
  satisfactionScore: number
  complaintsResolved: number
}

export interface TrendPoint {
  date: string
  count: number
}
