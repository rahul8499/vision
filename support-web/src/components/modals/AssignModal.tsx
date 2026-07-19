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
  assignees: { id: string; name: string; active_cases?: number }[]
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
      toast.success(`${itemLabel} was given to the selected staff member`)
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
      title={`Give ${itemLabel} to a staff member`}
      message={`Choose who will be responsible for this ${itemLabel.toLowerCase()}.`}
      confirmText="Give to this staff member"
      loading={isSubmitting}
    >
      <div className="mt-4">
        <SelectFilter
          label="Who should handle this?"
          value={selectedAgent}
          onChange={setSelectedAgent}
          options={assignees.map((a) => ({ value: a.id, label: `${a.name}${a.active_cases == null ? '' : ` — ${a.active_cases} active cases`}` }))}
        />
      </div>
    </ConfirmModal>
  )
}
