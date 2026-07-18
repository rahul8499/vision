import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CheckCircle2, Clock3, Phone, Radio, RefreshCw, Search, Send, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { emergencyMonitoringApi } from '@/api/emergencyMonitoringApi'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { DataTable } from '@/components/tables/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { Pagination } from '@/components/tables/Pagination'
import { useCurrentUser } from '@/store/authStore'
import { useAuthStore } from '@/store/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { EmergencyDispatchRow, EmergencyPolicy } from '@/types/emergencyMonitoring'
import { useCityStore } from '@/store/cityStore'

const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

export const EmergencyMonitoringPage = () => {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const wsBase = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/$/, '')
  const { subscribe, isConnected, isReconnecting } = useWebSocket(
    `${wsBase}/ws/support/emergency-monitoring/?token=${encodeURIComponent(token || '')}`,
  )
  const city = useCityStore((state) => state.selectedCityId)
  const setCity = useCityStore((state) => state.setSelectedCityId)
  const [status, setStatus] = useState('awaiting')
  const [requestType, setRequestType] = useState<'emergency' | 'normal'>('emergency')
  const [mode, setMode] = useState<'active' | 'history'>('active')
  const [search, setSearch] = useState('')
  const [push, setPush] = useState('')
  const [waitingMinutes, setWaitingMinutes] = useState('')
  const [page, setPage] = useState(1)
  const cities = useQuery({ queryKey: ['emergency-cities'], queryFn: emergencyMonitoringApi.getCities })
  const monitoring = useQuery({
    queryKey: ['emergency-monitoring', city, status, requestType, mode, search, push, waitingMinutes, page],
    queryFn: () => emergencyMonitoringApi.getRows({
      city: city || undefined, status, request_type: requestType, mode,
      search: search || undefined, push: push || undefined,
      waiting_minutes: waitingMinutes || undefined, page, page_size: 20,
    }),
    refetchInterval: isConnected ? false : 5_000,
  })
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['emergency-monitoring'] })
    const eventTypes = [
      'dispatch_created', 'store_opened', 'store_responded', 'reminder_sent',
      'support_escalated', 'mark_contacted', 'suppress_reminders', 'resume_reminders',
      'request_closed', 'push_failed',
    ]
    const unsubscribers = eventTypes.map((eventType) => subscribe(eventType, refresh))
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [queryClient, subscribe])
  const policyQuery = useQuery({
    queryKey: ['emergency-policy', city, requestType],
    queryFn: () => emergencyMonitoringApi.getPolicy(city, requestType),
  })
  const [draft, setDraft] = useState<EmergencyPolicy>()
  useEffect(() => { if (policyQuery.data) setDraft(policyQuery.data) }, [policyQuery.data])

  const remind = useMutation({
    mutationFn: emergencyMonitoringApi.remind,
    onSuccess: () => { toast.success('Reminder queued'); queryClient.invalidateQueries({ queryKey: ['emergency-monitoring'] }) },
    onError: () => toast.error('Reminder could not be queued'),
  })
  const savePolicy = useMutation({
    mutationFn: () => emergencyMonitoringApi.updatePolicy(draft!, city, requestType),
    onSuccess: () => { toast.success('City response policy updated'); queryClient.invalidateQueries({ queryKey: ['emergency-policy'] }) },
    onError: () => toast.error('Policy could not be updated'),
  })
  const action = useMutation({
    mutationFn: ({ id, value }: { id: number; value: 'mark_contacted' | 'suppress_reminders' | 'resume_reminders' }) => emergencyMonitoringApi.action(id, value),
    onSuccess: () => { toast.success('Monitoring action saved'); queryClient.invalidateQueries({ queryKey: ['emergency-monitoring'] }) },
    onError: () => toast.error('Action could not be saved'),
  })

  const columns = [
    { key: 'store', header: 'Store', render: (item: EmergencyDispatchRow) => <div><p className="font-semibold text-slate-900">{item.storeName}</p><p className="text-xs text-slate-500">{item.cityName}{item.serviceZoneName ? ` / ${item.serviceZoneName}` : ''}</p></div> },
    { key: 'request', header: 'Request', render: (item: EmergencyDispatchRow) => <div><span className="font-mono text-xs">#{item.prescriptionId}</span><p className={`text-[11px] font-semibold uppercase ${item.requestType === 'emergency' ? 'text-red-600' : 'text-slate-500'}`}>{item.requestType}</p></div> },
    { key: 'distance', header: 'Distance', render: (item: EmergencyDispatchRow) => item.distanceKm == null ? '—' : `${item.distanceKm.toFixed(1)} km` },
    { key: 'waiting', header: 'Waiting', render: (item: EmergencyDispatchRow) => <span className={item.escalatedAt ? 'font-semibold text-red-600' : ''}>{duration(item.waitingSeconds)}</span> },
    { key: 'engagement', header: 'Engagement', render: (item: EmergencyDispatchRow) => <div className="flex gap-1"><Badge variant={item.openedAt ? 'info' : 'default'}>{item.openedAt ? 'Opened' : 'Not opened'}</Badge><Badge variant={item.pushAvailable ? 'success' : 'warning'}>{item.pushAvailable ? 'Push ready' : 'No push'}</Badge></div> },
    { key: 'reminders', header: 'Reminders', render: (item: EmergencyDispatchRow) => <div><p>{item.reminderCount} auto · {item.manualReminderCount} manual</p>{item.remindersSuppressedAt && <p className="text-xs font-medium text-amber-600">Suppressed</p>}</div> },
    { key: 'contact', header: 'Contact', render: (item: EmergencyDispatchRow) => <a href={`tel:${item.storeMobile}`} className="inline-flex items-center gap-1 text-primary-700"><Phone className="h-3.5 w-3.5" />{item.storeMobile}</a> },
    { key: 'action', header: '', render: (item: EmergencyDispatchRow) => {
      const cooldownRemaining = item.lastManualReminderAt
        ? Math.max(0, item.manualCooldownSeconds - Math.floor((Date.now() - new Date(item.lastManualReminderAt).getTime()) / 1000))
        : 0
      return <div className="flex flex-wrap gap-1">
        {item.status === 'notified' && <Button size="sm" variant="secondary" disabled={!!item.remindersSuppressedAt || cooldownRemaining > 0} loading={remind.isPending && remind.variables === item.id} onClick={() => remind.mutate(item.id)}><Send className="h-3.5 w-3.5" />{cooldownRemaining ? `${cooldownRemaining}s` : 'Remind'}</Button>}
        {!item.supportContactedAt && <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: item.id, value: 'mark_contacted' })}>Contacted</Button>}
        <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: item.id, value: item.remindersSuppressedAt ? 'resume_reminders' : 'suppress_reminders' })}>{item.remindersSuppressedAt ? 'Resume' : 'Suppress'}</Button>
      </div>
    } },
  ]
  const summary = monitoring.data?.summary

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h1 className="text-2xl font-bold text-slate-950">Emergency monitoring</h1><p className="mt-1 text-sm text-slate-500">Live city-wise store response, reminders and escalations.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${isConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isConnected ? 'Live' : isReconnecting ? 'Reconnecting · polling every 5s' : 'Polling every 5s'}
        </span>
        <Button variant="secondary" loading={monitoring.isFetching} onClick={() => monitoring.refetch()}><RefreshCw className="h-4 w-4" />Refresh</Button>
        <select value={city} onChange={(event) => setCity(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">All permitted cities</option>{cities.data?.map(item => <option key={item.id} value={item.id}>{item.name}, {item.state}</option>)}</select>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <Metric icon={<Clock3 />} label="Awaiting" value={summary?.awaiting || 0} />
      <Metric icon={<CheckCircle2 />} label="Responded" value={summary?.responded || 0} />
      <Metric icon={<TriangleAlert />} label="Escalated" value={summary?.escalated || 0} danger />
      <Metric icon={<BellRing />} label="Push unavailable" value={summary?.push_unavailable || 0} danger />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      <button onClick={() => setRequestType('emergency')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${requestType === 'emergency' ? 'bg-red-600 text-white' : 'text-slate-600'}`}>Emergency requests</button>
      <button onClick={() => setRequestType('normal')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${requestType === 'normal' ? 'bg-primary-600 text-white' : 'text-slate-600'}`}>Normal requests</button>
    </div>
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => { setMode('active'); setPage(1) }} className={`rounded-lg px-3 py-2 text-sm ${mode === 'active' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Active now</button><button onClick={() => { setMode('history'); setPage(1) }} className={`rounded-lg px-3 py-2 text-sm ${mode === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>History</button></div>
    </div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
      <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Store, mobile or request ID…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></label>
      <select value={push} onChange={event => { setPush(event.target.value); setPage(1) }} className="h-9 rounded-lg border border-slate-200 px-3 text-sm"><option value="">All push states</option><option value="available">Push available</option><option value="unavailable">No push token</option></select>
      <select value={waitingMinutes} onChange={event => { setWaitingMinutes(event.target.value); setPage(1) }} className="h-9 rounded-lg border border-slate-200 px-3 text-sm"><option value="">Any waiting time</option><option value="3">Over 3 minutes</option><option value="5">Over 5 minutes</option><option value="10">Over 10 minutes</option></select>
    </div>
    {policyQuery.data && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">Automation for this scope: first reminder after <strong>{duration(policyQuery.data.firstStoreReminderSeconds)}</strong>, second after <strong>{duration(policyQuery.data.secondStoreReminderSeconds)}</strong>, support escalation after <strong>{duration(policyQuery.data.supportEscalationSeconds)}</strong>.</div>}
    <div className="flex gap-2">{['awaiting', 'escalated', 'responded', 'all'].map(value => <button key={value} onClick={() => setStatus(value)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${status === value ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}>{value}</button>)}</div>
    {monitoring.isLoading ? <Loading /> : monitoring.data?.results.length ? <><DataTable data={monitoring.data.results} columns={columns} keyExtractor={item => item.id} /><div className="rounded-xl border border-slate-200 bg-white"><Pagination currentPage={monitoring.data.pagination.page} totalPages={monitoring.data.pagination.total_pages} totalItems={monitoring.data.pagination.total_count} itemsPerPage={monitoring.data.pagination.page_size} onPageChange={setPage} /></div></> : <EmptyState icon={<Radio className="h-12 w-12" />} title="No dispatches in this view" description="The selected filters currently have no matching store dispatches." />}
    {user?.role === 'admin' && draft && <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4"><h2 className="font-semibold capitalize text-slate-900">{requestType} response policy</h2><p className="text-xs text-slate-500">{city ? 'Selected city override' : 'Global default used by cities without overrides'}</p></div>
      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField label="First reminder (seconds)" value={draft.firstStoreReminderSeconds} onChange={value => setDraft({ ...draft, firstStoreReminderSeconds: value })} />
        <NumberField label="Second reminder (seconds)" value={draft.secondStoreReminderSeconds} onChange={value => setDraft({ ...draft, secondStoreReminderSeconds: value })} />
        <NumberField label="Support escalation (seconds)" value={draft.supportEscalationSeconds} onChange={value => setDraft({ ...draft, supportEscalationSeconds: value })} />
        <NumberField label="Maximum reminders" min={0} value={draft.maxStoreReminders} onChange={value => setDraft({ ...draft, maxStoreReminders: value })} />
        <NumberField label="Manual cooldown (seconds)" value={draft.manualReminderCooldownSeconds} onChange={value => setDraft({ ...draft, manualReminderCooldownSeconds: value })} />
        <NumberField label="Manual daily limit/store" min={1} value={draft.manualReminderDailyLimit} onChange={value => setDraft({ ...draft, manualReminderDailyLimit: value })} />
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.remindersEnabled} onChange={event => setDraft({ ...draft, remindersEnabled: event.target.checked })} />Automatic store reminders</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.supportEscalationEnabled} onChange={event => setDraft({ ...draft, supportEscalationEnabled: event.target.checked })} />Support escalation</label>
      </div>
      <div className="mt-4 flex justify-end"><Button loading={savePolicy.isPending} onClick={() => savePolicy.mutate()}>Save policy</Button></div>
    </section>}
  </div>
}

const Metric = ({ icon, label, value, danger = false }: { icon: React.ReactElement; label: string; value: number; danger?: boolean }) => <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className={`rounded-lg p-2 [&_svg]:h-4 [&_svg]:w-4 ${danger && value ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{icon}</div><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
const NumberField = ({ label, value, onChange, min = 30 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) => <label className="text-xs font-medium text-slate-600">{label}<input type="number" min={min} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
