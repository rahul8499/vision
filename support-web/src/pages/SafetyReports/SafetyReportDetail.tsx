import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, MapPin, ShieldAlert, Store, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { safetyReportsApi } from '@/api/safetyReportsApi'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { InternalNotesPanel } from '@/components/threads/InternalNotesPanel'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { useCurrentUser } from '@/store/authStore'
import type { SafetyAction } from '@/types/safety'
import { SAFETY_REPORT_STATUS_COLORS, SAFETY_REPORT_SEVERITY_COLORS } from '@/types/safety'

const actionLabels: Record<SafetyAction, string> = {
  reviewed: 'Mark under review',
  warning_sent: 'Record warning sent',
  account_suspended: 'Suspend reported account',
  account_restored: 'Restore reported account',
  escalated: 'Send to senior team',
  closed: 'Close with resolution',
}
const label = (value: string) => value.replace(/_/g, ' ')

export const SafetyReportDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [selectedAction, setSelectedAction] = useState<SafetyAction>()
  const [actionNote, setActionNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const reportQuery = useQuery({
    queryKey: ['safety-report', id],
    queryFn: () => safetyReportsApi.getOne(id!),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['safety-report', id] })
    queryClient.invalidateQueries({ queryKey: ['safety-reports'] })
  }
  const assignMutation = useMutation({
    mutationFn: () => safetyReportsApi.assignToMe(id!),
    onSuccess: () => { refresh(); toast.success('Assigned to you') },
    onError: () => toast.error('Could not assign this report'),
  })
  const noteMutation = useMutation({
    mutationFn: (body: string) => safetyReportsApi.addInternalNote(id!, body),
    onSuccess: () => { refresh(); toast.success('Private staff note added') },
    onError: () => toast.error('Private staff note could not be added'),
  })
  const actionMutation = useMutation({
    mutationFn: () => safetyReportsApi.action(id!, selectedAction!, actionNote.trim()),
    onSuccess: () => {
      refresh(); toast.success('Safety action recorded'); setSelectedAction(undefined)
      setActionNote(''); setConfirmed(false)
    },
    onError: () => toast.error('Safety action failed'),
  })

  if (reportQuery.isLoading) return <Loading />
  if (reportQuery.error || !reportQuery.data) return <ErrorState title="Safety report not found" />
  const report = reportQuery.data
  const isClosed = report.status === 'closed'
  const canResolve = user?.role === 'supervisor' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'
  const highRisk = selectedAction === 'account_suspended' || selectedAction === 'account_restored'
  const openAction = (action: SafetyAction) => { setSelectedAction(action); setActionNote(''); setConfirmed(false) }

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-start gap-3">
      <button onClick={() => navigate('/safety-reports')} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-slate-400">Safety report #{report.id}</p>
        <h1 className="mt-1 text-2xl font-bold capitalize text-slate-950">{label(report.category)}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{report.scope === 'GLOBAL' ? 'Global platform report' : report.cityName || 'Unassigned city'}</p>
      </div>
      <Badge className={SAFETY_REPORT_SEVERITY_COLORS[report.severity]}>{report.severity}</Badge>
      <Badge className={SAFETY_REPORT_STATUS_COLORS[report.status]}>{label(report.status)}</Badge>
    </div>

    {isClosed ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <div><p className="font-semibold">Report resolved and closed</p><p className="mt-0.5 text-sm text-emerald-700">Resolution and full audit history are retained below.</p></div>
    </div> : <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-semibold text-slate-900">Case actions</p>
        {!report.assignedToId && <Button onClick={() => assignMutation.mutate()} loading={assignMutation.isPending}>Assign to me</Button>}
        {report.status === 'submitted' && <Button variant="secondary" onClick={() => openAction('reviewed')}>Start review</Button>}
        {canResolve && <>
          <Button variant="secondary" onClick={() => openAction('warning_sent')}>Record warning</Button>
          <Button variant="secondary" onClick={() => openAction('escalated')}>Send to senior team</Button>
          <Button onClick={() => openAction('closed')}>Resolve & close</Button>
        </>}
        {isAdmin && <>
          <Button variant="danger" onClick={() => openAction('account_suspended')}>Suspend account</Button>
          <Button variant="ghost" onClick={() => openAction('account_restored')}>Restore account</Button>
        </>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Every action requires evidence and is added to the permanent audit trail.</p>
    </div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="space-y-5">
        <Card title="What happened">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
          {report.resolutionNote && <div className="mt-4 rounded-lg bg-emerald-50 p-3"><p className="text-xs font-semibold uppercase text-emerald-700">Resolution</p><p className="mt-1 text-sm text-emerald-900">{report.resolutionNote}</p></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Prescription" value={report.prescriptionId ? `#${report.prescriptionId}` : 'Not linked'} />
            <Info label="Order/response" value={report.responseId ? `#${report.responseId}` : 'Not linked'} />
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Party icon={<User />} title="Reported by" name={report.reporterName} type={report.reporterType} />
          <Party
            icon={report.targetType === 'store' ? <Store /> : <User />}
            title="Reported party"
            name={report.reportedName}
            type={report.targetType}
            danger
            onOpen={(report.targetType === 'store' ? report.reportedStoreId : report.reportedUserId)
              ? () => navigate(`/${report.targetType === 'store' ? 'store' : 'user'}-lookup/${report.targetType === 'store' ? report.reportedStoreId : report.reportedUserId}`)
              : undefined}
          />
        </div>
        <Card title="Actions already taken">
          {!report.actionHistory.length ? <p className="text-sm text-slate-500">No actions recorded yet.</p> : <div className="space-y-3">{report.actionHistory.map((action) => <div key={action.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"><div className="rounded-lg bg-slate-100 p-2"><AlertTriangle className="h-4 w-4 text-slate-600" /></div><div><p className="text-sm"><strong>{action.adminName}</strong> · {label(action.action)}</p><p className="mt-0.5 text-sm text-slate-600">{action.note}</p><p className="mt-1 text-xs text-slate-400">{new Date(action.createdAt).toLocaleString()}</p></div></div>)}</div>}
        </Card>
      </div>
      <div className="space-y-5">
        <Card title="Steps to finish this case" subtitle="Complete these steps in order and record what you checked">
          <div className="space-y-3">
            <WorkflowStep done={!!report.assignedToId} number="1" title="Assign a staff member" description={report.assignedToName ? `Assigned to ${report.assignedToName}` : 'Choose who will handle this case.'} />
            <WorkflowStep done={report.status !== 'submitted'} number="2" title="Check the proof" description="Review what happened, the linked order and both people involved. Add a private staff note with your findings." />
            <WorkflowStep done={['action_taken', 'escalated', 'closed'].includes(report.status)} number="3" title="Write the decision" description="Explain any warning, senior-team review or account action and include evidence." />
            <WorkflowStep done={isClosed} number="4" title="Finish and close" description="Write clearly how the issue was solved, then close the case." />
          </div>
        </Card>
        <Card title="Case details">
          <div className="space-y-3">
            <Info label="How serious" value={report.severity} />
            <Info label="Status" value={label(report.status)} />
            <Info label="Assigned staff" value={report.assignedToName || 'Not assigned yet'} />
            <Info label="Created" value={new Date(report.createdAt).toLocaleString()} />
            <Info label="Last updated" value={new Date(report.updatedAt).toLocaleString()} />
          </div>
        </Card>
        <InternalNotesPanel
          notes={report.internalNotes.map((note) => ({ id: note.id, content: note.body, authorName: note.createdByName, createdAt: note.createdAt }))}
          onAddNote={(content) => noteMutation.mutateAsync(content).then(() => undefined)}
        />
      </div>
    </div>

    <Modal isOpen={!!selectedAction} onClose={() => setSelectedAction(undefined)} title={selectedAction ? actionLabels[selectedAction] : 'Safety action'}>
      <div className="space-y-4">
        {highRisk && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>High-risk action:</strong> this changes the reported account’s active state. Verify evidence before confirming.</div>}
        <label className="block text-sm font-medium text-slate-700">Reason / evidence note<textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Required audit note…" /></label>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />I verified the report evidence and confirm this action.</label>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelectedAction(undefined)}>Cancel</Button><Button variant={highRisk ? 'danger' : 'primary'} disabled={!confirmed || actionNote.trim().length < 5} loading={actionMutation.isPending} onClick={() => actionMutation.mutate()}>Confirm action</Button></div>
      </div>
    </Modal>
  </div>
}

const Info = ({ label: title, value }: { label: string; value: string }) => <div><p className="text-xs text-slate-500">{title}</p><p className="mt-0.5 text-sm font-medium capitalize text-slate-800">{value}</p></div>
const Party = ({ icon, title, name, type, danger = false, onOpen }: { icon: React.ReactElement; title: string; name: string; type: string; danger?: boolean; onOpen?: () => void }) => <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><div className={`rounded-lg p-2 [&_svg]:h-5 [&_svg]:w-5 ${danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{icon}</div><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wide text-slate-500">{title}</p><p className="truncate font-semibold text-slate-900">{name}</p><p className="text-xs capitalize text-slate-500">{type}</p></div>{onOpen && <button type="button" onClick={onOpen} className="text-xs font-semibold text-primary-600 hover:text-primary-700">View profile</button>}</div></div>
const WorkflowStep = ({ done, number, title, description }: { done: boolean; number: string; title: string; description: string }) => <div className="flex gap-3"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : number}</div><div><p className="text-sm font-semibold text-slate-800">{title}</p><p className="text-xs leading-5 text-slate-500">{description}</p></div></div>
