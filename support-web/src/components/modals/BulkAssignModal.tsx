import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

interface BulkAssignModalProps {
  isOpen: boolean
  onClose: () => void
  onAssign: (agentId: string, ids: string[]) => Promise<void>
  selectedIds: string[]
  assignees: { id: string; name: string }[]
  itemLabel?: string
}

export const BulkAssignModal = ({ isOpen, onClose, onAssign, selectedIds, assignees, itemLabel = 'items' }: BulkAssignModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')

  const handleClose = () => {
    setSelectedAgent('')
    onClose()
  }

  const handleAssign = async () => {
    if (!selectedAgent) return
    setIsSubmitting(true)
    try {
      await onAssign(selectedAgent, selectedIds)
      handleClose()
      toast.success(`${selectedIds.length} ${itemLabel} assigned successfully`)
    } catch {
      toast.error(`Failed to assign ${itemLabel.toLowerCase()}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleAssign}
      title={`Bulk Assign ${itemLabel}`}
      message={`Assign ${selectedIds.length} selected ${itemLabel.toLowerCase()} to a new agent?`}
      confirmText="Assign"
      loading={isSubmitting}
    >
      <div className="mt-4">
        <SelectFilter
          label="Select staff member"
          value={selectedAgent}
          onChange={setSelectedAgent}
          options={assignees.map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>
    </ConfirmModal>
  )
}
