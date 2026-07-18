import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { complaintsApi } from '@/api/complaintsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { BulkActions } from '@/components/tables/BulkActions'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { DateRangeFilter } from '@/components/filters/DateRangeFilter'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@/types/complaints'
import { COMPLAINT_STATUS_COLORS, COMPLAINT_PRIORITY_COLORS } from '@/types/complaints'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const CATEGORY_OPTIONS = [
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'app_issue', label: 'App Issue' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
]

export const ComplaintList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['complaints', page, debouncedSearch, status, priority, category],
    queryFn: () => complaintsApi.getAll({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status as ComplaintStatus) || undefined,
      priority: (priority as ComplaintPriority) || undefined,
      category: (category as ComplaintCategory) || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    staleTime: 30000,
  })

  const complaints = data?.results ?? []
  const pagination = data?.pagination

  const activeFilterCount = [status, priority, category, debouncedSearch].filter(Boolean).length

  const handleResetFilters = () => {
    setSearch('')
    setStatus('')
    setPriority('')
    setCategory('')
    setPage(1)
  }

  const columns = [
    { key: 'id', header: 'ID', render: (item: Complaint) => (
      <span className="font-mono text-xs text-gray-500">#{String(item.id).slice(0, 8)}</span>
    )},
    { key: 'subject', header: 'Subject', render: (item: Complaint) => (
      <div>
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{item.subject}</p>
        <p className="text-xs text-gray-500">{item.complainantName}</p>
      </div>
    )},
    { key: 'respondentName', header: 'Respondent', render: (item: Complaint) => item.respondentName },
    { key: 'status', header: 'Status', sortable: true, render: (item: Complaint) => (
      <Badge variant={COMPLAINT_STATUS_COLORS[item.status] || 'default'}>
        {item.statusDisplay || item.status.replace('_', ' ')}
      </Badge>
    )},
    { key: 'priority', header: 'Priority', sortable: true, render: (item: Complaint) => (
      <Badge variant={COMPLAINT_PRIORITY_COLORS[item.priority] || 'default'}>
        {item.priorityDisplay || item.priority}
      </Badge>
    )},
    { key: 'categoryDisplay', header: 'Category', render: (item: Complaint) => item.categoryDisplay || item.category.replace('_', ' ') },
    { key: 'createdAt', header: 'Created', sortable: true, render: (item: Complaint) => new Date(item.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="text-gray-500 mt-1">Manage and resolve customer complaints</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />}>
          New Complaint
        </Button>
      </div>

      <FilterBar onReset={handleResetFilters} activeFiltersCount={activeFilterCount}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectFilter label="Priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
      </FilterBar>

      <BulkActions
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {isLoading ? (
        <Loading />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="No complaints found"
          description="Try adjusting your filters or create a new complaint."
        />
      ) : (
        <>
          <DataTable
            data={complaints}
            columns={columns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => navigate(`/complaints/${item.id}`)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
          <div className="bg-white rounded-xl border border-gray-200">
            <Pagination
              currentPage={page}
              totalPages={pagination?.total_pages ?? 1}
              totalItems={pagination?.total_count ?? 0}
              itemsPerPage={20}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}
