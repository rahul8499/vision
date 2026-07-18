import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { complaintsApi } from '@/api/complaintsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { BulkActions } from '@/components/tables/BulkActions'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ArrowUpRight, Clock3 } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@/types/complaints'
import { COMPLAINT_STATUS_COLORS, COMPLAINT_PRIORITY_COLORS } from '@/types/complaints'
import { formatSafeDate } from '@/utils/formatters'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awaiting_info', label: 'Awaiting Info' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const CATEGORY_OPTIONS = [
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'wrong_or_expired_medicine', label: 'Wrong / Expired Medicine' },
  { value: 'overcharging', label: 'Overcharging / Billing' },
  { value: 'rude_behavior', label: 'Rude Behavior' },
  { value: 'fake_order', label: 'Fake / Spam Order' },
  { value: 'non_delivery', label: 'Non-Delivery' },
  { value: 'product_quality', label: 'Product Quality' },
  { value: 'payment_issue', label: 'Payment Issue' },
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
    { key: 'subject', header: 'Complaint', render: (item: Complaint) => (
      <div className="min-w-[230px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-slate-400">#{item.id}</span>
          {item.unreadCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.unreadCount} new</span>}
        </div>
        <p className="mt-1 max-w-[280px] truncate font-semibold text-slate-900">{item.subject}</p>
        <p className="mt-0.5 text-xs capitalize text-slate-500">{item.categoryDisplay}</p>
      </div>
    )},
    { key: 'complainantName', header: 'Filed by', render: (item: Complaint) => (
      <div><p className="font-medium text-slate-800">{item.complainantName}</p><p className="text-xs capitalize text-slate-400">{item.complainantType}</p></div>
    )},
    { key: 'respondentName', header: 'Against', render: (item: Complaint) => (
      <div><p className="font-medium text-slate-800">{item.respondentName}</p><p className="text-xs capitalize text-slate-400">{item.respondentType}</p></div>
    )},
    { key: 'status', header: 'Status', sortable: true, render: (item: Complaint) => (
      <Badge className={COMPLAINT_STATUS_COLORS[item.status]}>
        {item.statusDisplay || item.status.replace('_', ' ')}
      </Badge>
    )},
    { key: 'priority', header: 'Priority', sortable: true, render: (item: Complaint) => (
      <Badge className={COMPLAINT_PRIORITY_COLORS[item.priority]}>
        {item.priorityDisplay || item.priority}
      </Badge>
    )},
    { key: 'messageCount', header: 'Conversation', render: (item: Complaint) => (
      <div className="flex items-center gap-1.5 text-slate-600"><MessageSquare className="h-3.5 w-3.5" /><span>{item.messageCount}</span></div>
    )},
    { key: 'createdAt', header: 'Created', sortable: true, render: (item: Complaint) => (
      <div className="min-w-[125px]"><p className="text-sm text-slate-700">{formatSafeDate(item.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3 w-3" />{formatSafeDate(item.createdAt, { hour: '2-digit', minute: '2-digit' })}</p></div>
    )},
    { key: 'action', header: '', render: () => <ArrowUpRight className="h-4 w-4 text-slate-400" /> },
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Complaint inbox</h1>
          <p className="mt-1 text-sm text-slate-500">Investigate, respond and resolve customer complaints from one place.</p>
        </div>
        <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm sm:block">
          <p className="text-xs text-slate-500">Total complaints</p>
          <p className="text-lg font-bold text-slate-900">{pagination?.total_count ?? 0}</p>
        </div>
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
