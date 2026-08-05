import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Server, ShieldAlert, Users, XCircle } from 'lucide-react'
import { monitoringApi, type ProductionLog } from '@/api/monitoringApi'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { ErrorState } from '@/components/common/ErrorState'
import { Loading } from '@/components/common/Loading'
import type { StaffMember } from '@/types/staff'
import { ROLE_LABELS } from '@/types/auth'

const formatDate = (value?: string | null) => {
  if (!value) return 'No signal yet'
  return new Date(value).toLocaleString()
}

const getDetail = (log: ProductionLog, key: string) => {
  const value = log.details?.[key]
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const getStatusTone = (ok: boolean) => ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'

export const AdminMonitoringPage = () => {
  const query = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: monitoringApi.getSnapshot,
    refetchInterval: 30_000,
  })

  const summary = useMemo(() => {
    const data = query.data
    return {
      healthOk: data?.health.healthy ?? false,
      errors: data?.errors.length ?? 0,
      slow: data?.slowRequests.length ?? 0,
      activeStaff: data?.activeStaff.length ?? 0,
      totalStaff: data?.allStaff.length ?? 0,
    }
  }, [query.data])

  if (query.isLoading) return <Loading size="lg" className="min-h-[400px]" />
  if (query.error || !query.data) return <ErrorState title="Monitoring dashboard is unavailable" />

  const { health, errors, slowRequests, activeStaff, allStaff } = query.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Admin monitoring</h1>
          <p className="mt-1 text-sm text-gray-500">Live API status, production logs, active support users, and server health.</p>
        </div>
        <Button variant="secondary" onClick={() => query.refetch()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatusCard title="API status" value={summary.healthOk ? 'Up' : 'Check now'} icon={<Activity className="h-5 w-5" />} ok={summary.healthOk} />
        <StatusCard title="Server health" value={health.healthy ? 'Healthy' : 'Degraded'} icon={<Server className="h-5 w-5" />} ok={health.healthy} />
        <MetricCard title="Error logs" value={summary.errors} icon={<ShieldAlert className="h-5 w-5" />} danger={summary.errors > 0} />
        <MetricCard title="Slow requests" value={summary.slow} icon={<Clock3 className="h-5 w-5" />} danger={summary.slow > 0} />
        <MetricCard title="Active users" value={`${summary.activeStaff}/${summary.totalStaff}`} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card title="Server health" subtitle="Runtime probes refresh every 30 seconds">
          <div className="grid gap-3 sm:grid-cols-2">
            <HealthRow label="Redis cache" ok={health.redis.ok} detail={health.redis.ok ? 'Responding' : 'Probe failed'} />
            <HealthRow label="Automation heartbeat" ok={health.automation.ok} detail={formatDate(health.automation.last_heartbeat)} />
          </div>
        </Card>

        <Card title="Support web users" subtitle="Only admin users can open this monitoring page">
          <div className="grid gap-3 sm:grid-cols-3">
            <StaffCount role="Admin" count={allStaff.filter((staff) => staff.role === 'admin').length} />
            <StaffCount role="Supervisor" count={allStaff.filter((staff) => staff.role === 'supervisor').length} />
            <StaffCount role="Agent" count={allStaff.filter((staff) => staff.role === 'agent').length} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <LogPanel title="Recent app crashes and API errors" logs={errors} empty="No production errors recorded." tone="error" />
        <LogPanel title="Recent slow requests" logs={slowRequests} empty="No slow requests recorded." tone="slow" />
      </div>

      <Card title="Active support users" subtitle="Support staff accounts currently allowed to use Support Web">
        <div className="divide-y divide-slate-100">
          {activeStaff.length ? activeStaff.map((staff) => <StaffRow key={staff.id} staff={staff} />) : <p className="py-8 text-center text-sm text-slate-500">No active support users found.</p>}
        </div>
      </Card>
    </div>
  )
}

const StatusCard = ({ title, value, icon, ok }: { title: string; value: string; icon: React.ReactNode; ok: boolean }) => (
  <Card>
    <div className="flex items-center justify-between gap-3">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      <Badge className={getStatusTone(ok)}>{ok ? 'OK' : 'Alert'}</Badge>
    </div>
    <p className="mt-4 text-sm text-slate-500">{title}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </Card>
)

const MetricCard = ({ title, value, icon, danger = false }: { title: string; value: number | string; icon: React.ReactNode; danger?: boolean }) => (
  <Card>
    <div className="flex items-center justify-between gap-3">
      <div className={`rounded-lg p-2 ${danger ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{icon}</div>
      {danger ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
    </div>
    <p className="mt-4 text-sm text-slate-500">{title}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </Card>
)

const HealthRow = ({ label, ok, detail }: { label: string; ok: boolean; detail: string }) => (
  <div className="rounded-lg border border-slate-200 p-4">
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
      <p className="font-semibold text-slate-900">{label}</p>
    </div>
    <p className="mt-2 text-sm text-slate-500">{detail}</p>
  </div>
)

const StaffCount = ({ role, count }: { role: string; count: number }) => (
  <div className="rounded-lg border border-slate-200 p-4">
    <p className="text-sm text-slate-500">{role}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
  </div>
)

const LogPanel = ({ title, logs, empty, tone }: { title: string; logs: ProductionLog[]; empty: string; tone: 'error' | 'slow' }) => (
  <Card title={title}>
    <div className="divide-y divide-slate-100">
      {logs.length ? logs.map((log) => (
        <div key={log.id} className="py-3">
          <div className="flex flex-wrap items-start gap-2">
            <Badge className={tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>{log.action || 'event'}</Badge>
            <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{log.title || `${getDetail(log, 'method')} ${getDetail(log, 'path')}`}</p>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
            <span>Path: {getDetail(log, 'path')}</span>
            <span>Status: {getDetail(log, 'status_code')}</span>
            <span>Duration: {getDetail(log, 'duration_ms')} ms</span>
            <span>Request: {getDetail(log, 'request_id')}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{formatDate(log.created_at)}</p>
        </div>
      )) : <p className="py-8 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  </Card>
)

const StaffRow = ({ staff }: { staff: StaffMember }) => (
  <div className="flex flex-wrap items-center gap-3 py-3">
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-900">{staff.name}</p>
      <p className="text-sm text-slate-500">{staff.email}</p>
    </div>
    <Badge>{ROLE_LABELS[staff.role] || staff.role}</Badge>
    <span className="text-xs text-slate-500">Last seen: {formatDate(staff.lastLoginAt)}</span>
  </div>
)
