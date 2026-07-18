import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import toast from 'react-hot-toast'
import type { Refund } from '@/types/refunds'

interface RefundApproveModalProps {
  isOpen: boolean
  onClose: () => void
  onApprove: (notes?: string) => Promise<void>
  refund: Refund | null
}

export const RefundApproveModal = ({ isOpen, onClose, onApprove, refund }: RefundApproveModalProps) => {
  const { register, handleSubmit, reset } = useForm<{ notes: string }>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const notes = (document.querySelector('textarea[name="notes"]') as HTMLTextAreaElement)?.value || ''
      await onApprove(notes)
      handleClose()
      toast.success('Refund approved successfully')
    } catch {
      toast.error('Failed to approve refund')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refund) return null

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleApprove}
      title="Approve Refund"
      message={`Are you sure you want to approve refund of ${refund.currency} ${refund.amount.toFixed(2)} for order ${refund.orderId}?`}
      confirmText="Approve"
      loading={isSubmitting}
    />
  )
}
