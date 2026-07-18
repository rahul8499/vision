import { useState } from 'react'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import toast from 'react-hot-toast'

interface BulkCloseModalProps {
  isOpen: boolean
  onClose: () => void
  onCloseItems: (ids: string[]) => Promise<void>
  selectedIds: string[]
  itemLabel?: string
}

export const BulkCloseModal = ({ isOpen, onClose, onCloseItems, selectedIds, itemLabel = 'items' }: BulkCloseModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    onClose()
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onCloseItems(selectedIds)
      handleClose()
      toast.success(`${selectedIds.length} ${itemLabel.toLowerCase()} closed successfully`)
    } catch {
      toast.error(`Failed to close ${itemLabel.toLowerCase()}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={`Bulk Close ${itemLabel}`}
      message={`Are you sure you want to close ${selectedIds.length} selected ${itemLabel.toLowerCase()}? This action cannot be undone.`}
      confirmText="Close Selected"
      variant="danger"
      loading={isSubmitting}
    />
  )
}
