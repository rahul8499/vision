import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '@/api/notificationsApi'
import { useUIStore } from '@/store/uiStore'

const routeFor = (type?: unknown, id?: unknown) => type === 'complaint' ? `/complaints/${id}` : type === 'ticket' || type === 'platformsupportticket' ? `/tickets/${id}` : type === 'refund' || type === 'refundrequest' ? `/refunds/${id}` : type === 'safety_report' || type === 'safetyreport' ? `/safety-reports/${id}` : undefined

export const NotificationPanel = () => {
  const open = useUIStore(s => s.notificationPanelOpen), close = useUIStore(s => s.setNotificationPanelOpen)
  const navigate = useNavigate(), qc = useQueryClient()
  const query = useQuery({ queryKey: ['notifications-panel'], queryFn: () => notificationsApi.getAll({ limit: 30 }), enabled: open, refetchInterval: open ? 10_000 : false })
  useEffect(() => {
    if (!open) return
    notificationsApi.markAllAsRead().then(() => {
      qc.invalidateQueries({ queryKey: ['notifications-panel'] })
      window.dispatchEvent(new Event('support-notification-refresh'))
    }).catch(() => undefined)
  }, [open, qc])
  if (!open) return null
  return <><button aria-label="Close alerts" onClick={() => close(false)} className="fixed inset-0 z-40 bg-slate-950/20" /><aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"><div className="flex items-center border-b p-4"><div className="flex-1"><h2 className="font-bold text-slate-900">Case Alerts</h2><p className="text-xs text-slate-500">New assignments, urgent cases and case updates</p></div><button onClick={async () => { await notificationsApi.markAllAsRead(); qc.invalidateQueries({ queryKey: ['notifications-panel'] }); window.dispatchEvent(new Event('support-notification-refresh')) }} className="mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Mark all read"><CheckCheck className="h-5 w-5" /></button><button onClick={() => close(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="flex-1 divide-y overflow-y-auto">{query.isLoading ? <p className="p-6 text-sm text-slate-500">Loading alerts…</p> : query.data?.results.length ? query.data.results.map(n => <button key={n.id} onClick={async () => { if (!n.isRead) await notificationsApi.markAsRead(n.id); const route = routeFor(n.data?.entityType, n.data?.entityId); close(false); window.dispatchEvent(new Event('support-notification-refresh')); if (route) navigate(route) }} className={`flex w-full gap-3 p-4 text-left hover:bg-slate-50 ${n.isRead ? 'opacity-60' : 'bg-blue-50/40'}`}><div className="rounded-full bg-slate-100 p-2"><Bell className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">{n.title}</p><p className="mt-0.5 text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p></div></button>) : <p className="p-8 text-center text-sm text-slate-500">No new alerts.</p>}</div></aside></>
}
