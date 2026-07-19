import type { ReactNode } from 'react'

interface FilterBarProps {
  children: ReactNode
  onReset?: () => void
  activeFiltersCount?: number
}

export const FilterBar = ({ children, onReset, activeFiltersCount }: FilterBarProps) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          {children}
        </div>
        {onReset && (activeFiltersCount ?? 0) > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
          >
            Show all results
          </button>
        )}
      </div>
    </div>
  )
}
