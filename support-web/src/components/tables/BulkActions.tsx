import { Button } from '@/components/common/Button'
import { UserPlus, X } from 'lucide-react'
import type { UserRole } from '@/types/auth'

interface BulkActionsProps {
  selectedCount: number
  onClearSelection: () => void
  onAssign?: () => void
  onClose?: () => void
  assignees?: { id: string; name: string }[]
  availableAssignees?: { id: string; name: string }[]
}

export const BulkActions = ({
  selectedCount,
  onClearSelection,
  onAssign,
  onClose,
}: BulkActionsProps) => {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
      <span className="text-sm text-primary-700 font-medium">
        {selectedCount} case{selectedCount > 1 ? 's' : ''} chosen
      </span>
      <div className="h-4 w-px bg-primary-200" />
      {onAssign && (
        <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />} onClick={onAssign}>
          Give to a staff member
        </Button>
      )}
      {onClose && (
        <Button variant="primary" size="sm">
          Close chosen cases
        </Button>
      )}
      <div className="flex-1" />
      <button
        aria-label="Clear chosen cases"
        onClick={onClearSelection}
        className="p-1 rounded hover:bg-primary-100 transition-colors"
      >
        <X className="h-4 w-4 text-primary-700" />
      </button>
    </div>
  )
}
