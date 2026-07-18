import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

interface DateRangeFilterProps {
  from?: Date
  to?: Date
  onFromChange: (date?: Date) => void
  onToChange: (date?: Date) => void
  label?: string
}

export const DateRangeFilter = ({
  from,
  to,
  onFromChange,
  onToChange,
  label = 'Date Range',
}: DateRangeFilterProps) => {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{label}</label>
      <div className="relative">
        <input
          type="date"
          value={from ? format(from, 'yyyy-MM-dd') : ''}
          onChange={(e) => onFromChange(e.target.value ? new Date(e.target.value) : undefined)}
          className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
      <span className="text-gray-400">to</span>
      <div className="relative">
        <input
          type="date"
          value={to ? format(to, 'yyyy-MM-dd') : ''}
          onChange={(e) => onToChange(e.target.value ? new Date(e.target.value) : undefined)}
          className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
    </div>
  )
}
