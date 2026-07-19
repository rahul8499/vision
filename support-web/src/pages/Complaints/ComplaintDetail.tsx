import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Store, ShoppingBag, CalendarDays, Clock3, MessagesSquare,
  ExternalLink, CircleDot, Paperclip, Activity, ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { complaintsApi, normalizeComplaintMessage } from '@/api/complaintsApi'
import { assigneesApi } from '@/api/assigneesApi'
import { MessageThread } from '@/components/threads/MessageThread'
import { InternalNotesPanel } from '@/components/threads/InternalNotesPanel'
import { ContactHistoryPanel } from '@/components/threads/ContactHistoryPanel'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { AssignModal } from '@/components/modals/AssignModal'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { formatSafeDate } from '@/utils/formatters'
import type { Complaint, ComplaintMessageVisibility, ComplaintStatus } from '@/types/complaints'
import { COMPLAINT_STATUS_COLORS, COMPLAINT_PRIORITY_COLORS } from '@/types/complaints'

const STATUS_OPTIONS: Array<{ value: ComplaintStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'awaiting_info', label: 'Awaiting info' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
]

const labelize = (value?: string) => value?.replace(/_/g, ' ') || 'Not available'

export const ComplaintDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ComplaintStatus | ''>('')
  const [conversation, setConversation] = useState<ComplaintMessageVisibility>('USER_SUPPORT')
  const [assignOpen, setAssignOpen] = useState(false)
  const { hasAnyRole } = usePermissions()
  const canAssign = hasAnyRole(['admin', 'supervisor'])
  const token = useAuthStore((state) => state.accessToken)
  const wsBase = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/$/, '')
  const { subscribe, isConnected } = useWebSocket(`${wsBase}/ws/complaints/${id}/?token=${encodeURIComponent(token || '')}`)

  const complaintQuery = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getOne(id!),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: isConnected ? false : 5_000,
  })

  const notesQuery = useQuery({
    queryKey: ['complaint-notes', id],
    queryFn: () => complaintsApi.getInternalNotes(id!),
    enabled: !!id,
    staleTime: 10_000,
  })
  const assigneesQuery = useQuery({
    queryKey: ['assignees', complaintQuery.data?.scope, complaintQuery.data?.cityId],
    queryFn: () => assigneesApi.getAll(complaintQuery.data!.scope, complaintQuery.data?.cityId),
    enabled: canAssign && !!complaintQuery.data,
    staleTime: 60_000,
  })

  useEffect(() => {
    const receiveMessage = (payload: unknown) => {
      const incoming = normalizeComplaintMessage(payload as Record<string, unknown>)
      queryClient.setQueryData<Complaint>(['complaint', id], (current) => {
        if (!current || current.messages.some((message) => message.id === incoming.id)) return current
        return {
          ...current,
          messages: [...current.messages, incoming],
          messageCount: current.messageCount + 1,
          updatedAt: incoming.createdAt,
        }
      })
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    }
    return subscribe('complaint_message', receiveMessage)
  }, [id, queryClient, subscribe])

  const replyMutation = useMutation({
    mutationFn: (message: string) => complaintsApi.reply(id!, { text: message, visibility: conversation }),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: ['complaint', id] })
      const previous = queryClient.getQueryData<Complaint>(['complaint', id])
      if (previous) {
        queryClient.setQueryData<Complaint>(['complaint', id], {
          ...previous,
          messageCount: previous.messageCount + 1,
          messages: [...previous.messages, {
            id: -Date.now(),
            senderType: 'platform',
            senderName: 'Support team',
            visibility: conversation,
            text: message,
            isRead: true,
            createdAt: new Date().toISOString(),
          }],
        })
      }
      return { previous }
    },
    onError: (_error, _message, context) => {
      if (context?.previous) queryClient.setQueryData(['complaint', id], context.previous)
      toast.error('Reply could not be sent. Your message has been restored.')
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Complaint>(['complaint', id], (current) => {
        if (!current) return current
        const confirmed = current.messages.filter((item) => item.id >= 0 && item.id !== saved.id)
        return { ...current, messages: [...confirmed, saved] }
      })
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Reply sent')
    },
  })

  const noteMutation = useMutation({
    mutationFn: (content: string) => complaintsApi.addInternalNote(id!, content),
    onSuccess: (note) => {
      queryClient.setQueryData(['complaint-notes', id], (current: unknown) => [note, ...((current as unknown[]) || [])])
      toast.success('Private staff note added')
    },
    onError: () => toast.error('Private staff note could not be added'),
  })

  const statusMutation = useMutation({
    mutationFn: (nextStatus: ComplaintStatus) => complaintsApi.updateStatus(id!, nextStatus),
    onSuccess: (updated) => {
      queryClient.setQueryData(['complaint', id], updated)
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      setStatus('')
      toast.success(`Complaint marked ${updated.statusDisplay.toLowerCase()}`)
    },
    onError: () => toast.error('This status transition is not allowed'),
  })

  const complaint = complaintQuery.data
  const messages = useMemo(() => (complaint?.messages || [])
    .filter((message) => message.visibility === conversation)
    .map((message) => ({
    id: message.id,
    content: message.text,
    senderName: message.senderName,
    senderRole: message.senderType === 'platform' ? 'support' as const : 'user' as const,
    createdAt: message.createdAt,
    attachments: message.attachmentUrl ? [message.attachmentUrl] : [],
    pending: message.id < 0,
    isInternal: message.visibility === 'INTERNAL',
  })), [complaint?.messages, conversation])

  if (complaintQuery.isLoading) return <Loading />
  if (complaintQuery.error) return <ErrorState />
  if (!complaint) return <ErrorState title="Complaint not found" />

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Breadcrumbs />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button onClick={() => navigate('/complaints')} className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" aria-label="Back to complaints">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                  <span>Complaint #{complaint.id}</span><span>•</span>
                  <span className="capitalize">{complaint.categoryDisplay}</span>
                  <span className={`flex items-center gap-1 ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    <CircleDot className="h-3 w-3" /> {isConnected ? 'Live' : 'Refreshing'}
                  </span>
                </div>
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{complaint.subject}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={COMPLAINT_PRIORITY_COLORS[complaint.priority]}>{complaint.priorityDisplay} priority</Badge>
              <Badge className={COMPLAINT_STATUS_COLORS[complaint.status]}>{complaint.statusDisplay}</Badge>
              {canAssign && <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>Assign staff</Button>}
              <select value={status} onChange={(event) => setStatus(event.target.value as ComplaintStatus)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary-200">
                <option value="">Change status…</option>
                {STATUS_OPTIONS.filter((option) => option.value !== complaint.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <Button size="sm" disabled={!status} loading={statusMutation.isPending} onClick={() => status && statusMutation.mutate(status)}>Update</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          <Metric icon={<MessagesSquare />} label="Messages" value={String(complaint.messageCount)} />
          <Metric icon={<Paperclip />} label="Attachments" value={String(complaint.attachmentCount)} />
          <Metric icon={<Clock3 />} label="Last updated" value={formatSafeDate(complaint.updatedAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} />
          <Metric icon={<ShieldCheck />} label="Assigned staff" value={complaint.assignedToName || 'Not assigned yet'} />
        </div>
      </section>

      <AssignModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        itemLabel={`Complaint #${complaint.id}`}
        assignees={assigneesQuery.data || []}
        onAssign={async (agentId) => {
          await complaintsApi.assign(String(complaint.id), agentId)
          await queryClient.invalidateQueries({ queryKey: ['complaint', id] })
          await queryClient.invalidateQueries({ queryKey: ['complaints'] })
        }}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Messages for this case</h2><p className="text-xs text-slate-500">Choose who should see each message</p></div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{messages.length} messages</span>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 pt-3">
            {([
              ['USER_SUPPORT', 'User and support team'],
              ['STORE_SUPPORT', 'Store and support team'],
              ['SHARED', 'Visible to user and store'],
              ['INTERNAL', 'Support team only'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setConversation(value)}
                className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                  conversation === value
                    ? 'border border-b-white border-slate-200 bg-white text-slate-950'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`border-b px-5 py-2.5 text-xs font-medium ${
            conversation === 'SHARED'
              ? 'border-violet-100 bg-violet-50 text-violet-700'
              : conversation === 'INTERNAL'
                ? 'border-amber-100 bg-amber-50 text-amber-700'
              : 'border-blue-100 bg-blue-50 text-blue-700'
          }`}>
            Reply recipient: {conversation === 'USER_SUPPORT' ? 'User only' : conversation === 'STORE_SUPPORT' ? 'Store only' : conversation === 'SHARED' ? 'User and store' : 'Support team only'}
          </div>
          <MessageThread
            messages={messages}
            onReply={async (content) => { await replyMutation.mutateAsync(content) }}
            isSending={replyMutation.isPending}
            replyPlaceholder={conversation === 'INTERNAL' ? 'Write an internal support message…' : `Reply to ${conversation === 'USER_SUPPORT' ? 'user' : conversation === 'STORE_SUPPORT' ? 'store' : 'both parties'}…`}
          />
        </section>

        <aside className="space-y-5">
          <Panel title="Complaint details">
            {complaint.description && (
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Original complaint</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{complaint.description}</p>
              </div>
            )}
            <div className="space-y-4">
              <Party icon={complaint.complainantType === 'store' ? <Store /> : <User />} eyebrow="Filed by" name={complaint.complainantName} type={complaint.complainantType} />
              <div className="ml-4 h-5 border-l border-dashed border-slate-300" />
              <Party danger icon={complaint.respondentType === 'store' ? <Store /> : <User />} eyebrow="Complaint against" name={complaint.respondentName} type={complaint.respondentType} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Detail icon={<Activity />} label="Category" value={complaint.categoryDisplay} />
              <Detail icon={<CalendarDays />} label="Created" value={formatSafeDate(complaint.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })} />
              <Detail icon={<ShoppingBag />} label="Order" value={complaint.orderId ? `#${complaint.orderId}` : 'Not linked'} />
              <Detail icon={<ShieldCheck />} label="Assigned staff" value={complaint.assignedToName || 'Not assigned yet'} />
            </div>
            {complaint.orderId && <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">View linked order <ExternalLink className="h-3.5 w-3.5" /></button>}
          </Panel>

          <InternalNotesPanel notes={notesQuery.data || []} onAddNote={async (content) => { await noteMutation.mutateAsync(content) }} />
          <ContactHistoryPanel entityType="complaint" objectId={complaint.id} />

          <Panel title="Status history">
            {complaint.statusHistory.length === 0 ? <p className="text-sm text-slate-500">No status changes recorded yet.</p> : (
              <div className="space-y-4">
                {complaint.statusHistory.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-500 ring-4 ring-primary-50" />
                    <div><p className="text-sm text-slate-700"><span className="font-medium capitalize">{labelize(event.fromStatus)}</span> → <span className="font-medium capitalize">{labelize(event.toStatus)}</span></p>{event.note && <p className="mt-0.5 text-xs text-slate-500">{event.note}</p>}<p className="mt-1 text-xs text-slate-400">{formatSafeDate(event.createdAt)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}

const Metric = ({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) => (
  <div className="flex min-w-0 items-center gap-3 px-5 py-4 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-slate-400">
    <div className="rounded-lg bg-slate-50 p-2">{icon}</div><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate text-sm font-semibold text-slate-800">{value}</p></div>
  </div>
)

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2></div><div className="p-5">{children}</div></section>
)

const Party = ({ icon, eyebrow, name, type, danger }: { icon: React.ReactElement; eyebrow: string; name: string; type: string; danger?: boolean }) => (
  <div className="flex items-center gap-3">
    <div className={`rounded-xl p-2.5 [&_svg]:h-5 [&_svg]:w-5 ${danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{icon}</div>
    <div><p className="text-xs text-slate-500">{eyebrow}</p><p className="font-semibold text-slate-900">{name}</p><p className="text-xs capitalize text-slate-400">{type}</p></div>
  </div>
)

const Detail = ({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}{label}</div><p className="truncate text-sm font-medium capitalize text-slate-800">{value}</p></div>
)
