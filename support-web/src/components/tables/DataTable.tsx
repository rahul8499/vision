import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

type SortDirection = 'asc' | 'desc'

interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T, index: number) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T, index: number) => string | number
  onRowClick?: (item: T) => void
  isLoading?: boolean
  emptyMessage?: string
  selectedIds?: Set<string | number>
  onSelectionChange?: (ids: Set<string | number>) => void
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data available',
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const allSelected = data.length > 0 && selectedIds && data.every((item) => selectedIds.has(String(keyExtractor(item, 0))))
  const someSelected = selectedIds && data.some((item) => selectedIds.has(String(keyExtractor(item, 0))))

  const handleSelectAll = () => {
    if (!onSelectionChange || !selectedIds) return
    if (allSelected) {
      const newSelected = new Set(selectedIds)
      data.forEach((item) => newSelected.delete(String(keyExtractor(item, 0))))
      onSelectionChange(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      data.forEach((item) => newSelected.add(String(keyExtractor(item, 0))))
      onSelectionChange(newSelected)
    }
  }

  const handleSelectRow = (item: T) => {
    if (!onSelectionChange || !selectedIds) return
    const key = String(keyExtractor(item, 0))
    const newSelected = new Set(selectedIds)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    onSelectionChange(newSelected)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {onSelectionChange && (
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!(someSelected && !allSelected)
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''
                  } ${column.className || ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <span className="inline-flex flex-col">
                        <ChevronUp className={`h-3 w-3 ${sortKey === column.key && sortDirection === 'asc' ? 'text-gray-900' : 'text-gray-400'}`} />
                        <ChevronDown className={`h-3 w-3 -mt-1 ${sortKey === column.key && sortDirection === 'desc' ? 'text-gray-900' : 'text-gray-400'}`} />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="px-4 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const rowKey = keyExtractor(item, index)
                const isSelected = selectedIds?.has(String(rowKey))
                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-gray-50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-primary-50' : ''}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {onSelectionChange && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={() => handleSelectRow(item)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 text-sm text-gray-900 ${column.className || ''}`}>
                        {column.render ? column.render(item, index) : (item as Record<string, unknown>)[column.key] as ReactNode}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
