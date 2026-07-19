import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { refundsApi } from '@/api/refundsApi'
import { assigneesApi } from '@/api/assigneesApi'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { AssignModal } from '@/components/modals/AssignModal'
import { ArrowLeft, Wallet, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Refund } from '@/types/refunds'
import { REFUND_STATUS_COLORS } from '@/types/refunds'
import { usePermissions } from '@/hooks/usePermissions'

export const RefundDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentGateway, setPaymentGateway] = useState('')
  const [processedAmount, setProcessedAmount] = useState('')
  const [confirmAction, setConfirmAction] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const { hasAnyRole } = usePermissions()
  const canAssign = hasAnyRole(['admin', 'supervisor'])

  const { data: refund, isLoading, error } = useQuery({
    queryKey: ['refund', id],
    queryFn: () => refundsApi.getOne(id!),
    enabled: !!id,
    staleTime: 30000,
  })
  const assigneesQuery = useQuery({
    queryKey: ['assignees', 'CITY', refund?.cityId],
    queryFn: () => assigneesApi.getAll('CITY', refund?.cityId),
    enabled: canAssign && !!refund?.cityId,
    staleTime: 60_000,
  })

  const approveMutation = useMutation({
    mutationFn: () => refundsApi.approve(id!, { notes: adminNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      toast.success('Refund approved')
      setShowApproveModal(false)
      setAdminNote('')
      setConfirmAction(false)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => refundsApi.reject(id!, { reason: rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      toast.success('Refund rejected')
      setShowRejectModal(false)
      setRejectionReason('')
      setConfirmAction(false)
    },
  })

  const processMutation = useMutation({
    mutationFn: () => refundsApi.process(id!, { transactionId: paymentReference, paymentMethod: paymentGateway }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      toast.success('Refund processed')
      setShowProcessModal(false)
      setPaymentReference('')
      setPaymentGateway('')
      setProcessedAmount('')
      setConfirmAction(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => refundsApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      toast.success('Refund cancelled')
      setShowCancelModal(false)
      setConfirmAction(false)
    },
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!refund) return <ErrorState title="Refund not found" />

  const canApprove = refund.status === 'pending'
  const canReject = refund.status === 'pending'
  const canProcess = refund.status === 'approved'
  const canCancel = ['pending', 'approved'].includes(refund.status)

  return (
    <div className="space-y-4 max-w-4xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/refunds')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Refund #{String(refund.id).slice(0, 8)}</h1>
          <p className="text-gray-500 mt-1">Charge #{String(refund.charge).slice(0, 8)}</p>
        </div>
        <Badge variant={REFUND_STATUS_COLORS[refund.status] || 'default'}>{refund.status}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {canAssign && <Button variant="secondary" onClick={() => setAssignOpen(true)}>Assign staff</Button>}
        {canApprove && (
          <Button onClick={() => setShowApproveModal(true)}>Approve</Button>
        )}
        {canReject && (
          <Button variant="danger" onClick={() => setShowRejectModal(true)}>Reject</Button>
        )}
        {canProcess && (
          <Button onClick={() => setShowProcessModal(true)}>Process</Button>
        )}
        {canCancel && (
          <Button variant="secondary" onClick={() => setShowCancelModal(true)}>Cancel</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Refund request details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="text-sm font-medium">{refund.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={REFUND_STATUS_COLORS[refund.status] || 'default'}>{refund.status}</Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Reason</p>
                <p className="text-sm">{refund.reason}</p>
              </div>
              {refund.rejectionReason && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Rejection Reason</p>
                  <p className="text-sm text-red-600">{refund.rejectionReason}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Payment details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Payment Gateway</p>
                <p className="text-sm">{refund.paymentGateway || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Reference</p>
                <p className="text-sm font-mono">{refund.paymentReference || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Processed At</p>
                <p className="text-sm">{refund.processedAt ? new Date(refund.processedAt).toLocaleString() : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Approved At</p>
                <p className="text-sm">{refund.approvedAt ? new Date(refund.approvedAt).toLocaleString() : '-'}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="People and dates">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Requested By</p>
                <p className="text-sm font-medium">{refund.requestedByName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Assigned To</p>
                <p className="text-sm">{refund.assignedToName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reviewed By</p>
                <p className="text-sm">{refund.reviewedByName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{new Date(refund.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Updated</p>
                <p className="text-sm">{new Date(refund.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </Card>

        </div>
      </div>

      <AssignModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        itemLabel={`Refund #${String(refund.id).slice(0, 8)}`}
        assignees={assigneesQuery.data || []}
        onAssign={async (agentId) => {
          await refundsApi.assign(String(refund.id), agentId)
          await queryClient.invalidateQueries({ queryKey: ['refund', id] })
          await queryClient.invalidateQueries({ queryKey: ['refunds'] })
        }}
      />

      {/* Approve Modal */}
      <Modal isOpen={showApproveModal} onClose={() => { setShowApproveModal(false); setConfirmAction(false); }} title="Approve Refund">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              You are about to approve a refund of <strong>{refund.amount.toFixed(2)}</strong>.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approval Note</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              rows={3}
              placeholder="Optional note..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmApprove"
              checked={confirmAction}
              onChange={(e) => setConfirmAction(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="confirmApprove" className="text-sm text-gray-700">I confirm this refund approval</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowApproveModal(false); setConfirmAction(false); }}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending} disabled={!confirmAction}>Approve</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showRejectModal} onClose={() => { setShowRejectModal(false); setConfirmAction(false); }} title="Reject Refund">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">This action will permanently reject the refund request.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              rows={3}
              placeholder="Reason for rejection..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmReject"
              checked={confirmAction}
              onChange={(e) => setConfirmAction(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="confirmReject" className="text-sm text-gray-700">I confirm this refund rejection</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowRejectModal(false); setConfirmAction(false); }}>Cancel</Button>
            <Button variant="danger" onClick={() => rejectMutation.mutate()} loading={rejectMutation.isPending} disabled={!confirmAction || !rejectionReason}>Reject</Button>
          </div>
        </div>
      </Modal>

      {/* Process Modal */}
      <Modal isOpen={showProcessModal} onClose={() => { setShowProcessModal(false); setConfirmAction(false); }} title="Process Refund">
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              Process refund of <strong>{refund.amount.toFixed(2)}</strong> through payment gateway.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Gateway</label>
              <select
                value={paymentGateway}
                onChange={(e) => setPaymentGateway(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              >
                <option value="">Select gateway...</option>
                <option value="razorpay">Razorpay</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                placeholder="Transaction ID"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Processed Amount</label>
            <input
              type="number"
              value={processedAmount}
              onChange={(e) => setProcessedAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              placeholder={refund.amount.toString()}
              step="0.01"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmProcess"
              checked={confirmAction}
              onChange={(e) => setConfirmAction(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="confirmProcess" className="text-sm text-gray-700">I confirm this refund processing</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowProcessModal(false); setConfirmAction(false); }}>Cancel</Button>
            <Button onClick={() => processMutation.mutate()} loading={processMutation.isPending} disabled={!confirmAction || !paymentGateway || !paymentReference}>Process</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={showCancelModal} onClose={() => { setShowCancelModal(false); setConfirmAction(false); }} title="Cancel Refund">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">This action will cancel the refund request. This cannot be undone.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmCancel"
              checked={confirmAction}
              onChange={(e) => setConfirmAction(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="confirmCancel" className="text-sm text-gray-700">I confirm this refund cancellation</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowCancelModal(false); setConfirmAction(false); }}>Back</Button>
            <Button variant="danger" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending} disabled={!confirmAction}>Cancel Refund</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
