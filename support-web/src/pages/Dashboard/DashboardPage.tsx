import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboardApi'
import { StatsCard } from '@/components/charts/StatsCard'
import { TrendChart } from '@/components/charts/TrendChart'
import { SimpleBarChart } from '@/components/charts/BarChart'
import { Loading } from '@/components/common/Loading'
import {
  MessageSquare,
  Ticket,
  Wallet,
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'

export const DashboardPage = () => {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    staleTime: 60000,
  })

  const stats = useMemo(() => {
    if (!raw) return null
    const c = raw.complaints || {}
    const t = raw.tickets || {}
    const r = raw.refunds || {}
    const s = raw.safety_reports || {}
    const st = raw.staff || {}
    const n = raw.notifications || {}

    const resolvedComplaints = Object.entries(c.status_distribution || {})
      .filter(([status]) => status !== 'open')
      .reduce((sum, [, count]) => sum + count, 0)

    return {
      openComplaints: c.open ?? 0,
      resolvedComplaints,
      openTickets: t.open ?? 0,
      avgTicketResponseTimeMinutes: null,
      pendingRefunds: r.pending ?? 0,
      refundApprovalRate: null,
      openSafetyReports: s.open ?? 0,
      criticalSafetyReports: 0,
      totalComplaints: c.total ?? 0,
      totalTickets: t.total ?? 0,
      totalRefundAmount: 0,
      avgResolutionTimeHours: null,
      complaintTrend: [],
      ticketTrend: [],
      agentPerformance: [],
    }
  }, [raw])

  if (isLoading) {
    return <Loading size="lg" className="min-h-[400px]" />
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">No data available</div>
  }

  const fmt = (v: number | null) => (v === null ? 'N/A' : `$${v.toLocaleString()}`)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of support metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Open Complaints"
          value={stats.openComplaints}
          subtitle={`${stats.resolvedComplaints} resolved`}
          icon={<MessageSquare className="h-5 w-5" />}
          trend={{ value: 12, label: 'vs last week' }}
        />
        <StatsCard
          title="Open Tickets"
          value={stats.openTickets}
          subtitle={`Avg response: ${stats.avgTicketResponseTimeMinutes ?? 'N/A'}m`}
          icon={<Ticket className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending Refunds"
          value={stats.pendingRefunds}
          subtitle={`${stats.refundApprovalRate ?? 'N/A'}% approval rate`}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatsCard
          title="Safety Reports"
          value={stats.openSafetyReports}
          subtitle={`${stats.criticalSafetyReports} critical`}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Complaints"
          value={stats.totalComplaints}
          trend={{ value: 8, label: 'vs last month' }}
        />
        <StatsCard
          title="Total Tickets"
          value={stats.totalTickets}
          trend={{ value: -3, label: 'vs last month' }}
        />
        <StatsCard
          title="Total Refunds"
          value={fmt(stats.totalRefundAmount)}
          trend={{ value: 15, label: 'vs last month' }}
        />
        <StatsCard
          title="Avg Resolution Time"
          value={stats.avgResolutionTimeHours !== null ? `${stats.avgResolutionTimeHours}h` : 'N/A'}
          subtitle="For complaints"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaint Trends</h3>
          {stats.complaintTrend?.length > 0 ? (
            <TrendChart data={stats.complaintTrend.map((p) => ({ date: p.date, value: p.count }))} color="#ef4444" />
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No trend data available</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Trends</h3>
          {stats.ticketTrend?.length > 0 ? (
            <TrendChart data={stats.ticketTrend.map((p) => ({ date: p.date, value: p.count }))} color="#3b82f6" />
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No trend data available</p>
          )}
        </div>
      </div>

      {stats.agentPerformance?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance</h3>
          <SimpleBarChart
            data={stats.agentPerformance.map((a) => ({
              name: a.agentName.split(' ')[0],
              value: a.ticketsResolved,
            }))}
            color="#10b981"
            height={250}
          />
        </div>
      )}
    </div>
  )
}
