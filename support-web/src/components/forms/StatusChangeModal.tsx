import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import type { ComplaintStatus } from '@/types/complaints'

interface StatusChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (status: string) => Promise<void>
  title: string
  currentStatus?: string
  statusOptions: { value: string; label: string }[]
  itemType: 'complaint' | 'ticket'
}

export const StatusChangeModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  statusOptions,
  itemType,
}: StatusChangeModalProps) => {
  const [selectedStatus, setSelectedStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    setSelectedStatus('')
    onClose()
  }

  const handleConfirm = async () => {
    if (!selectedStatus) return
    setIsSubmitting(true)
    try {
      await onConfirm(selectedStatus)
      handleClose()
    } catch {
      // handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={title}
      message={`Choose what stage this ${itemType} is now in.`}
      confirmText="Save current progress"
      loading={isSubmitting}
    >
      <div className="mt-4">
        <SelectFilter
          label="What is happening with this case now?"
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(value)}
          options={statusOptions}
        />
      </div>
    </ConfirmModal>
  )
}
