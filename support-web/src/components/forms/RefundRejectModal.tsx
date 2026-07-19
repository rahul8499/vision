import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import toast from 'react-hot-toast'
import type { Refund } from '@/types/refunds'

interface RefundRejectModalProps {
  isOpen: boolean
  onClose: () => void
  onReject: (reason: string) => Promise<void>
  refund: Refund | null
}

export const RefundRejectModal = ({ isOpen, onClose, onReject, refund }: RefundRejectModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ reason: string }>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleReject = async (data: { reason: string }) => {
    setIsSubmitting(true)
    try {
      await onReject(data.reason)
      handleClose()
      toast.success('Refund rejected')
    } catch {
      toast.error('Failed to reject refund')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refund) return null

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleSubmit(handleReject)}
      title="Reject Refund"
      message={`Reject ${refund.currency} ${refund.amount.toFixed(2)} refund for payment ${refund.charge}?`}
      confirmText="Reject"
      variant="danger"
      loading={isSubmitting}
    >
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection *</label>
        <Input
          as="textarea"
          rows={3}
          placeholder="Please provide a reason..."
          error={errors.reason?.message}
          {...register('reason', { required: 'Rejection reason is required', minLength: { value: 10, message: 'Reason must be at least 10 characters' } })}
        />
      </div>
    </ConfirmModal>
  )
}
