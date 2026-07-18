import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import toast from 'react-hot-toast'
import type { Refund } from '@/types/refunds'

interface RefundProcessModalProps {
  isOpen: boolean
  onClose: () => void
  onProcess: (transactionId: string, paymentMethod: string) => Promise<void>
  refund: Refund | null
}

export const RefundProcessModal = ({ isOpen, onClose, onProcess, refund }: RefundProcessModalProps) => {
  const { register, handleSubmit, reset } = useForm<{ transactionId: string; paymentMethod: string }>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleProcess = async (data: { transactionId: string; paymentMethod: string }) => {
    setIsSubmitting(true)
    try {
      await onProcess(data.transactionId, data.paymentMethod)
      handleClose()
      toast.success('Refund processed successfully')
    } catch {
      toast.error('Failed to process refund')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refund) return null

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleSubmit(handleProcess)}
      title="Process Refund"
      message={`Process refund of ${refund.currency} ${refund.amount.toFixed(2)} for order ${refund.orderId}?`}
      confirmText="Process Refund"
      loading={isSubmitting}
    >
      <div className="mt-4 space-y-3">
        <Input label="Transaction ID" placeholder="TXN_..." {...register('transactionId', { required: 'Transaction ID is required' })} />
        <Input label="Payment Method" placeholder="e.g., Original Payment Method" {...register('paymentMethod', { required: 'Payment method is required' })} />
      </div>
    </ConfirmModal>
  )
}
