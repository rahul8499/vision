import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

interface AssignModalProps {
  isOpen: boolean
  onClose: () => void
  onAssign: (agentId: string) => Promise<void>
  assignees: { id: string; name: string }[]
  itemLabel?: string
}

export const AssignModal = ({ isOpen, onClose, onAssign, assignees, itemLabel = 'item' }: AssignModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')
  const { reset } = useForm()

  const handleClose = () => {
    setSelectedAgent('')
    reset()
    onClose()
  }

  const handleAssign = async () => {
    if (!selectedAgent) return
    setIsSubmitting(true)
    try {
      await onAssign(selectedAgent)
      handleClose()
      toast.success(`${itemLabel} assigned successfully`)
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : `Failed to assign ${itemLabel.toLowerCase()}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleAssign}
      title={`Assign ${itemLabel}`}
      message={`Select an agent to assign this ${itemLabel.toLowerCase()} to.`}
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
