import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ticketsApi } from '@/api/ticketsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { BulkActions } from '@/components/tables/BulkActions'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useNavigate } from 'react-router-dom'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { Ticket as TicketData, TicketStatus, TicketPriority, TicketType, TicketChannel } from '@/types/tickets'
import { TICKET_STATUS_COLORS, TICKET_PRIORITY_COLORS } from '@/types/tickets'

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

const TYPE_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'billing', label: 'Billing' },
  { value: 'account', label: 'Account' },
  { value: 'general', label: 'General' },
  { value: 'escalation', label: 'Escalation' },
]

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'chat', label: 'Chat' },
  { value: 'app', label: 'App' },
  { value: 'web', label: 'Web' },
]

export const TicketList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, debouncedSearch, status, priority],
    queryFn: () => ticketsApi.getAll({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status as TicketStatus) || undefined,
      priority: (priority as TicketPriority) || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    staleTime: 30000,
  })

  const tickets = data?.results ?? []
  const pagination = data?.pagination

  const activeFilterCount = [status, priority, debouncedSearch].filter(Boolean).length

  const handleResetFilters = () => {
    setSearch('')
    setStatus('')
    setPriority('')
    setPage(1)
  }

  const columns = [
    { key: 'id', header: 'ID', render: (item: TicketData) => (
      <span className="font-mono text-xs text-gray-500">#{String(item.id).slice(0, 8)}</span>
    )},
    { key: 'subject', header: 'Subject', render: (item: TicketData) => (
      <div>
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{item.subject}</p>
        <p className="text-xs text-gray-500">{item.categoryDisplay}</p>
      </div>
    )},
    { key: 'priority', header: 'Priority', render: (item: TicketData) => (
      <Badge variant={TICKET_PRIORITY_COLORS[item.priority] || 'default'}>
        {item.priorityDisplay || item.priority}
      </Badge>
    )},
    { key: 'status', header: 'Status', render: (item: TicketData) => (
      <Badge variant={TICKET_STATUS_COLORS[item.status] || 'default'}>
        {item.statusDisplay || item.status.replace('_', ' ')}
      </Badge>
    )},
    { key: 'createdAt', header: 'Created', sortable: true, render: (item: TicketData) => new Date(item.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-500 mt-1">Manage support tickets</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />}>
          New Ticket
        </Button>
      </div>

      <FilterBar onReset={handleResetFilters} activeFilterCount={activeFilterCount}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectFilter label="Priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
      </FilterBar>

      <BulkActions selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())} />

      {isLoading ? (
        <Loading />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="h-12 w-12" />}
          title="No tickets found"
          description="Try adjusting your filters or create a new ticket."
        />
      ) : (
        <>
          <DataTable
            data={tickets}
            columns={columns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => navigate(`/tickets/${item.id}`)}
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
