import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bell, BarChart3, Clock3, Copy, Headphones, MessageSquareText, PhoneCall } from 'lucide-react'
import { operationsApi } from '@/api/operationsApi'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/common/Badge'
import { useCurrentUser } from '@/store/authStore'

const tabs = [
  ['work', 'My Assigned Cases', Headphones], ['sla', 'Response Deadlines', Clock3], ['notifications', 'Alerts', Bell],
  ['contacts', 'Calls & Follow-ups', PhoneCall], ['replies', 'Reply Templates', MessageSquareText], ['analytics', 'Team Reports', BarChart3],
] as const
const routeFor = (type: string, id: number) => type.includes('complaint') ? `/complaints/${id}` : type.includes('ticket') ? `/tickets/${id}` : type.includes('refund') ? `/refunds/${id}` : type.includes('safety') ? `/safety-reports/${id}` : undefined
const SIMPLE_LABELS: Record<string, string> = {
  complaint: 'Customer complaint',
  ticket: 'Help request',
  refund: 'Refund request',
  refundrequest: 'Refund request',
  safetyreport: 'Safety issue',
  safety_report: 'Safety issue',
  under_review: 'Being checked',
  awaiting_info: 'Waiting for information',
  waiting_for_user: 'Waiting for requester',
  in_progress: 'Work in progress',
  action_taken: 'Action completed',
  escalated: 'Sent to senior team',
  submitted: 'New',
}
const label = (value: string) => SIMPLE_LABELS[value] || value?.replace(/_/g, ' ') || '—'

export const OperationsPage = () => {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('work')
  const [contact, setContact] = useState({ entity_type: 'complaint', object_id: '', channel: 'call', outcome: 'contacted', note: '', follow_up_at: '' })
  const [reply, setReply] = useState({ title: '', body: '', category: '', visibility: 'shared' })
  const user = useCurrentUser()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['operations'], queryFn: operationsApi.getOverview, refetchInterval: 30_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['operations'] })
  const readAll = useMutation({ mutationFn: operationsApi.markAllRead, onSuccess: refresh })
  const addContact = useMutation({ mutationFn: operationsApi.addContact, onSuccess: () => { refresh(); toast.success('Follow-up recorded'); setContact({ ...contact, object_id: '', note: '', follow_up_at: '' }) }, onError: () => toast.error('Could not record follow-up') })
  const addReply = useMutation({ mutationFn: operationsApi.addSavedReply, onSuccess: () => { refresh(); toast.success('Saved reply created'); setReply({ title: '', body: '', category: '', visibility: 'shared' }) }, onError: () => toast.error('Could not create saved reply') })

  if (query.isLoading) return <Loading />
  if (query.error || !query.data) return <ErrorState title="Work and reports are unavailable" />
  const data = query.data
  const downloadReport = () => {
    const rows = [
      ['Metric', 'Value'], ['Open complaints', data.analytics.complaints.open], ['Total complaints', data.analytics.complaints.total],
      ['Open tickets', data.analytics.tickets.open], ['Total tickets', data.analytics.tickets.total],
      ['Pending refunds', data.analytics.refunds.pending], ['Total refunds', data.analytics.refunds.total],
      ['Open safety reports', data.analytics.safety_reports.open], ['Total safety reports', data.analytics.safety_reports.total],
      ['Active staff', data.analytics.staff.active], ['Unread notifications', data.analytics.notifications.unread],
    ]
    const blob = new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `support-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-950">My Work & Reports</h1><p className="mt-1 text-sm text-slate-500">See your assigned cases, response deadlines, follow-ups, ready replies and team reports.</p></div>
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">{tabs.map(([key, title, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{title}</button>)}</div>

    {tab === 'work' && <Card title="Cases assigned to me" subtitle="Open cases that you need to work on"><div className="divide-y divide-slate-100">{data.my_work.length ? data.my_work.map((item: any) => <button key={`${item.type}-${item.id}`} onClick={() => { const route = routeFor(item.type, item.id); if (route) navigate(route) }} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900">{item.title}</p><p className="text-xs capitalize text-slate-500">{label(item.type)} #{item.id} · {new Date(item.created_at).toLocaleString()}</p></div><Badge>{label(item.priority)}</Badge><Badge>{label(item.status)}</Badge></button>) : <Empty text="No open cases are assigned to you." />}</div></Card>}

    {tab === 'sla' && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(data.sla.breaches).map(([key, value]) => <Card key={key}><p className="text-xs font-semibold uppercase text-slate-500">{label(key)}</p><div className="mt-2 flex items-end gap-4"><div><p className={`text-3xl font-bold ${Number(data.sla.first_response_breaches[key]) ? 'text-red-600' : 'text-emerald-600'}`}>{String(data.sla.first_response_breaches[key] || 0)}</p><p className="text-xs text-slate-500">late first replies</p></div><div><p className={`text-3xl font-bold ${Number(value) ? 'text-red-600' : 'text-emerald-600'}`}>{String(value)}</p><p className="text-xs text-slate-500">late closures</p></div></div></Card>)}</div><Card title="Response and closing time limits"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Case</th><th>Priority</th><th>Reply within</th><th>Close within</th></tr></thead><tbody>{data.sla.policies.map((p: any) => <tr key={p.id} className="border-b"><td className="p-2 capitalize">{label(p.entity_type)}</td><td className="capitalize">{p.priority}</td><td>{p.first_response_minutes} min</td><td>{p.resolution_minutes} min</td></tr>)}</tbody></table></div></Card></div>}

    {tab === 'notifications' && <Card title="Case alerts" actions={<Button size="sm" variant="secondary" onClick={() => readAll.mutate()}>Mark all read</Button>}><div className="divide-y">{data.notifications.length ? data.notifications.map((n: any) => <button key={n.id} onClick={async () => { await operationsApi.markRead(n.id); refresh(); const route = routeFor(n.entity_type, Number(n.entity_id)); if (route) navigate(route) }} className={`w-full py-3 text-left ${n.is_read ? 'opacity-60' : ''}`}><p className="font-medium text-slate-900">{n.title}</p><p className="text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p></button>) : <Empty text="No new alerts." />}</div></Card>}

    {tab === 'contacts' && <div className="grid gap-5 lg:grid-cols-2"><Card title="Add a call or follow-up"><div className="space-y-3"><Field label="Case type"><select value={contact.entity_type} onChange={e => setContact({ ...contact, entity_type: e.target.value })} className="input"><option value="complaint">Complaint</option><option value="ticket">Support ticket</option><option value="refund">Refund</option><option value="safety_report">Safety report</option></select></Field><Field label="Case ID"><input value={contact.object_id} onChange={e => setContact({ ...contact, object_id: e.target.value })} className="input" type="number" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Contact method"><select value={contact.channel} onChange={e => setContact({ ...contact, channel: e.target.value })} className="input"><option value="call">Call</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></Field><Field label="What happened"><select value={contact.outcome} onChange={e => setContact({ ...contact, outcome: e.target.value })} className="input"><option value="contacted">Contacted</option><option value="no_answer">No answer</option><option value="callback">Callback requested</option><option value="message_sent">Message sent</option><option value="resolved">Resolved</option></select></Field></div><Field label="Contact again on"><input type="datetime-local" value={contact.follow_up_at} onChange={e => setContact({ ...contact, follow_up_at: e.target.value })} className="input" /></Field><Field label="Note"><textarea value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} className="input" rows={3} /></Field><Button disabled={!contact.object_id} loading={addContact.isPending} onClick={() => addContact.mutate({ ...contact, object_id: Number(contact.object_id), follow_up_at: contact.follow_up_at || null })}>Save follow-up</Button></div></Card><Card title="My recent calls and messages"><div className="divide-y">{data.contacts.length ? data.contacts.map((c: any) => <div key={c.id} className="py-3"><p className="text-sm font-medium capitalize">{label(c.channel)} · {label(c.outcome)}</p><p className="text-xs text-slate-500">{label(c.entity_type)} #{c.object_id} · {new Date(c.created_at).toLocaleString()}</p><p className="mt-1 text-sm text-slate-600">{c.note}</p></div>) : <Empty text="No calls or messages recorded yet." />}</div></Card></div>}

    {tab === 'replies' && <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">{user?.role !== 'agent' && <Card title="Create a ready reply"><div className="space-y-3"><Field label="Title"><input className="input" value={reply.title} onChange={e => setReply({ ...reply, title: e.target.value })} /></Field><Field label="Category"><input className="input" value={reply.category} onChange={e => setReply({ ...reply, category: e.target.value })} /></Field><Field label="Who can see it"><select className="input" value={reply.visibility} onChange={e => setReply({ ...reply, visibility: e.target.value })}><option value="shared">User and store</option><option value="user">User</option><option value="store">Store</option><option value="internal">Support team only</option></select></Field><Field label="Reply"><textarea className="input" rows={5} value={reply.body} onChange={e => setReply({ ...reply, body: e.target.value })} /></Field><Button disabled={!reply.title || !reply.body} onClick={() => addReply.mutate(reply)}>Create a ready reply</Button></div></Card>}<Card title="Ready replies you can use"><div className="grid gap-3">{data.saved_replies.length ? data.saved_replies.map((r: any) => <div key={r.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start"><div className="flex-1"><p className="font-semibold">{r.title}</p><p className="text-xs capitalize text-slate-500">{r.category || 'General'} · {r.visibility}</p></div><Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(r.body); toast.success('Reply copied') }} leftIcon={<Copy className="h-4 w-4" />}>Copy</Button></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{r.body}</p></div>) : <Empty text="No ready replies have been created yet." />}</div></Card></div>}

    {tab === 'analytics' && <div className="space-y-4"><div className="flex justify-end"><Button variant="secondary" onClick={downloadReport}>Download report</Button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric title="Open complaints" value={data.analytics.complaints.open} /><Metric title="Open help requests" value={data.analytics.tickets.open} /><Metric title="Refunds waiting for action" value={data.analytics.refunds.pending} /><Metric title="Open safety issues" value={data.analytics.safety_reports.open} /><Metric title="Active staff" value={data.analytics.staff.active} /><Metric title="Unread alerts" value={data.analytics.notifications.unread} /></div><div className="grid gap-4 lg:grid-cols-3"><Distribution title="Complaints by status" values={data.analytics.complaints.status_distribution} /><Distribution title="Help requests by status" values={data.analytics.tickets.status_distribution} /><Distribution title="Refunds by status" values={data.analytics.refunds.status_distribution} /></div></div>}
  </div>
}

const Empty = ({ text }: { text: string }) => <p className="py-8 text-center text-sm text-slate-500">{text}</p>
const Metric = ({ title, value }: { title: string; value: number }) => <Card><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p></Card>
const Distribution = ({ title, values }: { title: string; values: Record<string, number> }) => <Card title={title}><div className="space-y-2">{Object.entries(values || {}).map(([key, value]) => <div key={key} className="flex justify-between text-sm"><span className="capitalize text-slate-600">{label(key)}</span><strong>{value}</strong></div>)}</div></Card>
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-medium text-slate-700">{label}<div className="mt-1 [&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-slate-300 [&_.input]:bg-white [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm">{children}</div></label>
