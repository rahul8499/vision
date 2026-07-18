import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { safetyReportsApi } from '@/api/safetyReportsApi'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { InternalNotesPanel } from '@/components/threads/InternalNotesPanel'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ArrowLeft, ShieldAlert, User, Store, FileText, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { SafetyReport } from '@/types/safety'
import { SAFETY_REPORT_STATUS_COLORS, SAFETY_REPORT_SEVERITY_COLORS } from '@/types/safety'

export const SafetyReportDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetStoreId, setTargetStoreId] = useState('')
  const [confirmAction, setConfirmAction] = useState(false)

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['safety-report', id],
    queryFn: () => safetyReportsApi.getOne(id!),
    enabled: !!id,
    staleTime: 30000,
  })

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => safetyReportsApi.addInternalNote(id!, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety-report', id] }),
  })

  const actionMutation = useMutation({
    mutationFn: () => safetyReportsApi.assign(id!, selectedAction, actionNote, targetUserId ? Number(targetUserId) : undefined, targetStoreId ? Number(targetStoreId) : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-report', id] })
      queryClient.invalidateQueries({ queryKey: ['safety-reports'] })
      toast.success('Action recorded')
      setShowActionModal(false)
      setActionNote('')
      setSelectedAction('')
      setConfirmAction(false)
    },
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!report) return <ErrorState title="Safety report not found" />

  const highRiskActions = ['permanent_block', 'suspend']
  const isHighRisk = highRiskActions.includes(selectedAction)

  return (
    <div className="space-y-4 max-w-4xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/safety-reports')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{report.category.replace('_', ' ')}</h1>
          <p className="text-gray-500 mt-1">Report #{String(report.id).slice(0, 8)}</p>
        </div>
        <Badge variant={SAFETY_REPORT_SEVERITY_COLORS[report.severity] || 'default'}>{report.severity}</Badge>
        <Badge variant={SAFETY_REPORT_STATUS_COLORS[report.status] || 'default'}>{report.status.replace('_', ' ')}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => { setSelectedAction('under_review'); setShowActionModal(true); }}>Mark Under Review</Button>
        <Button variant="secondary" onClick={() => { setSelectedAction('request_info'); setShowActionModal(true); }}>Request More Info</Button>
        <Button variant="secondary" onClick={() => { setSelectedAction('warn'); setShowActionModal(true); }}>Warn User/Store</Button>
        <Button variant="secondary" onClick={() => { setSelectedAction('suspend'); setShowActionModal(true); }}>Temporarily Suspend</Button>
        <Button variant="danger" onClick={() => { setSelectedAction('permanent_block'); setShowActionModal(true); }}>Permanently Block</Button>
        <Button variant="danger" onClick={() => { setSelectedAction('escalate'); setShowActionModal(true); }}>Escalate to Admin</Button>
        <Button variant="secondary" onClick={() => { setSelectedAction('close'); setShowActionModal(true); }}>Close</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Report Details">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.description}</p>
              </div>
              {report.resolutionNote && (
                <div>
                  <p className="text-xs text-gray-500">Resolution Note</p>
                  <p className="text-sm text-gray-700">{report.resolutionNote}</p>
                </div>
              )}
              {report.prescriptionId && (
                <div>
                  <p className="text-xs text-gray-500">Related Prescription</p>
                  <p className="text-sm font-mono">Prescription #{report.prescriptionId}</p>
                </div>
              )}
              {report.responseId && (
                <div>
                  <p className="text-xs text-gray-500">Related Prescription Response</p>
                  <p className="text-sm font-mono">Response #{report.responseId}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Reporter">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{report.reporterName}</p>
                <p className="text-sm text-gray-500 capitalize">{report.reporterType}</p>
              </div>
            </div>
          </Card>

          <Card title="Reported Entity">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Store className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{report.reportedName}</p>
                <p className="text-sm text-gray-500 capitalize">{report.targetType}</p>
              </div>
            </div>
          </Card>

          <Card title="Action History">
            <div className="space-y-3">
              {(report.actionHistory || []).length === 0 ? (
                <p className="text-sm text-gray-500">No actions recorded yet.</p>
              ) : (
                (report.actionHistory || []).map((action) => (
                  <div key={action.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{action.adminName}</span> performed{' '}
                        <span className="font-medium">{action.action.replace('_', ' ')}</span>
                      </p>
                      {action.note && <p className="text-xs text-gray-500 mt-0.5">{action.note}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(action.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Report Info">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm">{report.category.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Assigned To</p>
                <p className="text-sm">{report.assignedToName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{new Date(report.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Updated</p>
                <p className="text-sm">{new Date(report.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <InternalNotesPanel
            notes={report.internalNotes?.map((n) => ({ id: n.id, content: n.body, authorName: n.createdByName, createdAt: n.createdAt })) || []}
            onAddNote={async (content) => { await addNoteMutation.mutateAsync(content); toast.success('Note added') }}
          />
        </div>
      </div>

      {/* Action Modal */}
      <Modal isOpen={showActionModal} onClose={() => { setShowActionModal(false); setConfirmAction(false); }} title={`${selectedAction.replace('_', ' ')}`}>
        <div className="space-y-4">
          {isHighRisk && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">High-risk action</p>
              <p className="text-sm text-red-700 mt-1">This action may permanently affect the user/store. A reason is required.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note {isHighRisk && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              rows={3}
              placeholder={isHighRisk ? 'Reason for this action (required)...' : 'Optional note...'}
            />
          </div>
          {isHighRisk && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target User ID (optional)</label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                placeholder="User ID"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmAction"
              checked={confirmAction}
              onChange={(e) => setConfirmAction(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="confirmAction" className="text-sm text-gray-700">I confirm this action</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowActionModal(false); setConfirmAction(false); }}>Cancel</Button>
            <Button onClick={() => actionMutation.mutate()} loading={actionMutation.isPending} disabled={!confirmAction || (isHighRisk && !actionNote)}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
