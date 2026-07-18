import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CircleDot, Clock3, LifeBuoy, MessageSquare, ShieldCheck, User, Store, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { normalizeTicketMessage, ticketsApi } from '@/api/ticketsApi'
import { MessageThread } from '@/components/threads/MessageThread'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'
import { formatSafeDate } from '@/utils/formatters'
import type { Ticket, TicketStatus } from '@/types/tickets'
import { TICKET_PRIORITY_COLORS, TICKET_STATUS_COLORS } from '@/types/tickets'

const STATUS_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_for_user', label: 'Waiting for requester' },
  { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
]

export const TicketDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const [nextStatus, setNextStatus] = useState<TicketStatus | ''>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const wsBase = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/$/, '')
  const { subscribe, isConnected } = useWebSocket(`${wsBase}/ws/support-tickets/${id}/?token=${encodeURIComponent(token || '')}`)

  const ticketQuery = useQuery({
    queryKey: ['ticket', id], queryFn: () => ticketsApi.getOne(id!), enabled: !!id,
    staleTime: 10_000, refetchInterval: isConnected ? false : 5_000,
  })

  useEffect(() => subscribe('support_ticket_message', (payload) => {
    const incoming = normalizeTicketMessage(payload as Record<string, unknown>)
    queryClient.setQueryData<Ticket>(['ticket', id], (current) => {
      if (!current || current.messages.some((message) => message.id === incoming.id)) return current
      return { ...current, messages: [...current.messages, incoming], messageCount: current.messageCount + 1, updatedAt: incoming.createdAt }
    })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }), [id, queryClient, subscribe])

  useEffect(() => subscribe('support_ticket_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }), [id, queryClient, subscribe])

  const replyMutation = useMutation({
    mutationFn: (text: string) => ticketsApi.reply(id!, { text }),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ['ticket', id] })
      const previous = queryClient.getQueryData<Ticket>(['ticket', id])
      if (previous) queryClient.setQueryData<Ticket>(['ticket', id], {
        ...previous, messageCount: previous.messageCount + 1,
        messages: [...previous.messages, { id: -Date.now(), senderType: 'platform', senderName: 'AARX Support', text, isRead: true, createdAt: new Date().toISOString() }],
      })
      return { previous }
    },
    onError: (_error, _text, context) => {
      if (context?.previous) queryClient.setQueryData(['ticket', id], context.previous)
      toast.error('Reply could not be sent')
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Ticket>(['ticket', id], (current) => current ? {
        ...current, messages: [...current.messages.filter((message) => message.id >= 0 && message.id !== saved.id), saved],
      } : current)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Reply sent')
    },
  })

  const statusMutation = useMutation({
    mutationFn: () => ticketsApi.updateStatus(id!, nextStatus as TicketStatus, resolutionNote.trim() || undefined),
    onSuccess: (update) => {
      queryClient.setQueryData<Ticket>(['ticket', id], (current) => current ? { ...current, ...update } : current)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setNextStatus(''); setResolutionNote('')
      toast.success('Ticket updated')
    },
    onError: () => toast.error('Ticket status could not be updated'),
  })

  const ticket = ticketQuery.data
  const messages = useMemo(() => (ticket?.messages || []).map((message) => ({
    id: message.id, content: message.text, senderName: message.senderName,
    senderRole: message.senderType === 'platform' ? 'support' as const : 'user' as const,
    createdAt: message.createdAt, attachments: message.attachment ? [message.attachment] : [], pending: message.id < 0,
  })), [ticket?.messages])

  if (ticketQuery.isLoading) return <Loading />
  if (ticketQuery.error || !ticket) return <ErrorState title="Support ticket not found" />

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Breadcrumbs />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button onClick={() => navigate('/tickets')} className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
              <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500"><span>Support #{ticket.id}</span><span>•</span><span>{ticket.categoryDisplay}</span><span className={`flex items-center gap-1 ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}><CircleDot className="h-3 w-3" />{isConnected ? 'Live' : 'Refreshing'}</span></div><h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{ticket.subject}</h1></div>
            </div>
            <div className="flex flex-wrap gap-2"><Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>{ticket.priorityDisplay} priority</Badge><Badge className={TICKET_STATUS_COLORS[ticket.status]}>{ticket.statusDisplay}</Badge></div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          <Metric icon={<MessageSquare />} label="Messages" value={String(ticket.messageCount)} />
          <Metric icon={<Clock3 />} label="Last activity" value={formatSafeDate(ticket.updatedAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} />
          <Metric icon={<CalendarDays />} label="Created" value={formatSafeDate(ticket.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })} />
          <Metric icon={<ShieldCheck />} label="Ownership" value={ticket.assignedTo || 'Unassigned'} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Requester conversation</h2><p className="text-xs text-slate-500">Replies appear immediately in the user or store app</p></div>
          <MessageThread messages={messages} onReply={async (text) => { await replyMutation.mutateAsync(text) }} isSending={replyMutation.isPending} showReplyForm={ticket.status !== 'closed'} />
        </section>

        <aside className="space-y-5">
          <Panel title="Request details">
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What happened</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description || 'No description provided.'}</p></div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">{ticket.requesterType === 'store' ? <Store className="h-5 w-5" /> : <User className="h-5 w-5" />}</div>
              <div><p className="text-xs text-slate-500">Requested by</p><p className="font-semibold text-slate-900">{ticket.requesterName}</p><p className="text-xs capitalize text-slate-400">{ticket.requesterType}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3"><Detail icon={<Tag />} label="Issue type" value={ticket.categoryDisplay} /><Detail icon={<LifeBuoy />} label="Channel" value="In-app support" /></div>
          </Panel>

          <Panel title="Resolve ticket">
            <label className="mb-1 block text-xs font-medium text-slate-600">Change status</label>
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as TicketStatus)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary-200"><option value="">Select status…</option>{STATUS_OPTIONS.filter((option) => option.value !== ticket.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            {(nextStatus === 'resolved' || nextStatus === 'closed') && <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={4} placeholder="Explain what was fixed and any next steps…" className="mt-3 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-primary-200" />}
            <Button className="mt-3 w-full" disabled={!nextStatus || ((nextStatus === 'resolved' || nextStatus === 'closed') && !resolutionNote.trim())} loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>Update ticket</Button>
          </Panel>

          {ticket.resolutionNote && <Panel title="Resolution"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.resolutionNote}</p>{ticket.resolvedAt && <p className="mt-2 text-xs text-slate-400">Resolved {formatSafeDate(ticket.resolvedAt)}</p>}</Panel>}
        </aside>
      </div>
    </div>
  )
}

const Metric = ({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) => <div className="flex min-w-0 items-center gap-3 px-5 py-4 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-slate-400"><div className="rounded-lg bg-slate-50 p-2">{icon}</div><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate text-sm font-semibold text-slate-800">{value}</p></div></div>
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2></div><div className="p-5">{children}</div></section>
const Detail = ({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) => <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}{label}</div><p className="text-sm font-medium text-slate-800">{value}</p></div>
