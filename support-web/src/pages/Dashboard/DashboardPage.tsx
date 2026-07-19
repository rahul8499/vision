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
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    staleTime: 60000,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <Loading size="lg" className="min-h-[400px]" />
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">No data available</div>
  }

  const fmt = (v: number | null) => (v === null ? 'N/A' : `₹${v.toLocaleString('en-IN')}`)
  const trend = (points: { count: number }[]) => {
    const current = points.slice(-7).reduce((sum, point) => sum + point.count, 0)
    const previous = points.slice(-14, -7).reduce((sum, point) => sum + point.count, 0)
    return previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Overview</h1>
        <p className="text-gray-500 mt-1">Overview of support metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Open Complaints"
          value={stats.openComplaints}
          subtitle={`${stats.resolvedComplaints} resolved`}
          icon={<MessageSquare className="h-5 w-5" />}
          trend={{ value: trend(stats.complaintTrend), label: 'vs previous 7 days' }}
        />
        <StatsCard
          title="Open Help Requests"
          value={stats.openTickets}
          subtitle={`Average first reply: ${stats.avgTicketResponseTimeMinutes ?? 'N/A'} min`}
          icon={<Ticket className="h-5 w-5" />}
        />
        <StatsCard
          title="Refunds Waiting for Action"
          value={stats.pendingRefunds}
          subtitle={stats.refundApprovalRate == null ? 'No decided refunds yet' : `${stats.refundApprovalRate}% approved`}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatsCard
          title="Open Safety Issues"
          value={stats.openSafetyReports}
          subtitle={`${stats.criticalSafetyReports} critical`}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Complaints"
          value={stats.totalComplaints}
          trend={{ value: trend(stats.complaintTrend), label: 'vs previous 7 days' }}
        />
        <StatsCard
          title="Total Help Requests"
          value={stats.totalTickets}
          trend={{ value: trend(stats.ticketTrend), label: 'vs previous 7 days' }}
        />
        <StatsCard
          title="Total Refunds"
          value={fmt(stats.totalRefundAmount)}
          trend={{ value: trend(stats.refundTrend), label: 'vs previous 7 days' }}
        />
        <StatsCard
          title="Average Time to Close"
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
              value: a.ticketsResolved + a.complaintsResolved,
            }))}
            color="#10b981"
            height={250}
          />
          <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500"><th className="py-2">Support agent</th><th>Cases resolved</th><th>Average first reply</th><th>Customer rating</th></tr></thead><tbody>{stats.agentPerformance.map(agent => <tr key={agent.agentId} className="border-b"><td className="py-2 font-medium">{agent.agentName}</td><td>{agent.ticketsResolved + agent.complaintsResolved}</td><td>{agent.avgResponseTimeMinutes ? `${agent.avgResponseTimeMinutes} min` : 'No replies measured'}</td><td>{agent.satisfactionScore == null ? 'No ratings yet' : `${agent.satisfactionScore} / 5`}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  )
}
