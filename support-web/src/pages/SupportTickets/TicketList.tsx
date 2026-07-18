import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock3, LifeBuoy, MessageSquare } from 'lucide-react'
import { ticketsApi } from '@/api/ticketsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useDebounce } from '@/hooks/useDebounce'
import { formatSafeDate } from '@/utils/formatters'
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '@/types/tickets'
import { TICKET_PRIORITY_COLORS, TICKET_STATUS_COLORS } from '@/types/tickets'
import { useCityStore } from '@/store/cityStore'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_for_user', label: 'Waiting for requester' },
  { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
]
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
]
const CATEGORY_OPTIONS = [
  { value: 'app_bug', label: 'App bug' }, { value: 'account', label: 'Account access' },
  { value: 'verification', label: 'Verification' }, { value: 'subscription', label: 'Subscription & billing' },
  { value: 'technical', label: 'Technical problem' }, { value: 'feature', label: 'Feature request' },
  { value: 'other', label: 'Other' },
]

export const TicketList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const city = useCityStore((state) => state.selectedCityId)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, debouncedSearch, status, priority, category, city],
    queryFn: () => ticketsApi.getAll({
      page, limit: 20, search: debouncedSearch || undefined,
      status: status as TicketStatus || undefined,
      priority: priority as TicketPriority || undefined,
      category: category as TicketCategory || undefined,
      city: city || undefined,
    }),
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  const tickets = data?.results || []
  const pagination = data?.pagination
  const reset = () => { setSearch(''); setStatus(''); setPriority(''); setCategory(''); setPage(1) }
  const columns = [
    { key: 'subject', header: 'Support request', render: (ticket: Ticket) => (
      <div className="min-w-[240px]">
        <div className="flex items-center gap-2"><span className="font-mono text-[11px] font-medium text-slate-400">#{ticket.id}</span>{ticket.unreadCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{ticket.unreadCount} new</span>}</div>
        <p className="mt-1 max-w-[300px] truncate font-semibold text-slate-900">{ticket.subject}</p>
        <p className="mt-0.5 text-xs text-slate-500">{ticket.categoryDisplay}</p>
      </div>
    )},
    { key: 'requesterName', header: 'Requester', render: (ticket: Ticket) => (
      <div><p className="font-medium text-slate-800">{ticket.requesterName}</p><p className="text-xs capitalize text-slate-400">{ticket.requesterType}</p></div>
    )},
    { key: 'scope', header: 'Scope', render: (ticket: Ticket) => ticket.scope === 'GLOBAL' ? 'Global' : (ticket.cityName || 'City') },
    { key: 'priority', header: 'Priority', render: (ticket: Ticket) => <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>{ticket.priorityDisplay}</Badge> },
    { key: 'status', header: 'Status', render: (ticket: Ticket) => <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{ticket.statusDisplay}</Badge> },
    { key: 'messageCount', header: 'Conversation', render: (ticket: Ticket) => <span className="flex items-center gap-1.5 text-slate-600"><MessageSquare className="h-3.5 w-3.5" />{ticket.messageCount}</span> },
    { key: 'updatedAt', header: 'Last activity', render: (ticket: Ticket) => (
      <div className="min-w-[135px]"><p className="text-sm text-slate-700">{formatSafeDate(ticket.updatedAt, { day: '2-digit', month: 'short', year: 'numeric' })}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3 w-3" />{formatSafeDate(ticket.updatedAt, { hour: '2-digit', minute: '2-digit' })}</p></div>
    )},
    { key: 'action', header: '', render: () => <ArrowUpRight className="h-4 w-4 text-slate-400" /> },
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-950">Platform support inbox</h1><p className="mt-1 text-sm text-slate-500">App, account, verification, subscription and technical help requests sent directly to AARX Support.</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm"><p className="text-xs text-slate-500">Total requests</p><p className="text-lg font-bold text-slate-900">{pagination?.total_count || 0}</p></div>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"><strong>Platform tickets</strong> are for AARX product or account help. User–pharmacy disputes belong in Complaints.</div>
      <FilterBar onReset={reset} activeFiltersCount={[status, priority, category, debouncedSearch].filter(Boolean).length}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectFilter label="Priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
      </FilterBar>
      {isLoading ? <Loading /> : tickets.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-12 w-12" />} title="No support requests found" description="Try adjusting the filters." />
      ) : <>
        <DataTable data={tickets} columns={columns} keyExtractor={(ticket) => ticket.id} onRowClick={(ticket) => navigate(`/tickets/${ticket.id}`)} />
        <div className="rounded-xl border border-slate-200 bg-white"><Pagination currentPage={page} totalPages={pagination?.total_pages || 1} totalItems={pagination?.total_count || 0} itemsPerPage={20} onPageChange={setPage} /></div>
      </>}
    </div>
  )
}
