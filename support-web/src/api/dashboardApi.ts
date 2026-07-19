import apiClient from './axios'
import type { DashboardStats } from '@/types/dashboard'

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/summary/')
    const raw = response.data.data || {}
    const complaints = raw.complaints || {}
    const tickets = raw.tickets || {}
    const refunds = raw.refunds || {}
    const safety = raw.safety_reports || {}
    const complaintStatuses = complaints.status_distribution || {}
    return {
      totalComplaints: Number(complaints.total || 0),
      openComplaints: Number(complaints.open || 0),
      resolvedComplaints: Number(complaints.resolved || 0),
      avgResolutionTimeHours: complaints.average_resolution_hours == null ? null : Number(complaints.average_resolution_hours),
      totalTickets: Number(tickets.total || 0),
      openTickets: Number(tickets.open || 0),
      avgTicketResponseTimeMinutes: tickets.average_first_response_minutes == null ? null : Number(tickets.average_first_response_minutes),
      totalRefunds: Number(refunds.total || 0),
      pendingRefunds: Number(refunds.pending || 0),
      refundApprovalRate: refunds.approval_rate == null ? null : Number(refunds.approval_rate),
      totalRefundAmount: Number(refunds.processed_amount || 0),
      totalSafetyReports: Number(safety.total || 0),
      openSafetyReports: Number(safety.open || 0),
      criticalSafetyReports: Number(safety.critical || 0),
      agentPerformance: (raw.agent_performance || []).map((item: any) => ({ agentId: String(item.agent_id), agentName: item.agent_name, ticketsResolved: Number(item.tickets_resolved || 0), complaintsResolved: Number(item.complaints_resolved || 0), avgResponseTimeMinutes: item.avg_response_time_minutes == null ? 0 : Number(item.avg_response_time_minutes), satisfactionScore: item.satisfaction_score == null ? null : Number(item.satisfaction_score) })),
      complaintTrend: complaints.trend || [], ticketTrend: tickets.trend || [], refundTrend: refunds.trend || [],
    }
  },

  getAgentPerformance: async (): Promise<unknown> => {
    const response = await apiClient.get('/dashboard/agent-workload/')
    return response.data.data
  },

  getTrends: async (params: { period?: string; type?: string }): Promise<unknown> => {
    const response = await apiClient.get('/dashboard/trends/', { params })
    return response.data.data
  },
}
