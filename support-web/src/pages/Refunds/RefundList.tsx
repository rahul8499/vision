import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { refundsApi } from '@/api/refundsApi'
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
import { Wallet } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { Refund, RefundStatus } from '@/types/refunds'
import { REFUND_STATUS_COLORS } from '@/types/refunds'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processed', label: 'Processed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const RefundList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['refunds', page, debouncedSearch, status, dateFrom, dateTo],
    queryFn: () => refundsApi.getAll({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status as RefundStatus) || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    staleTime: 30000,
  })

  const refunds = data?.results ?? []
  const pagination = data?.pagination

  const columns = [
    { key: 'id', header: 'Refund ID', render: (item: Refund) => (
      <span className="font-mono text-xs text-gray-500">#{String(item.id).slice(0, 8)}</span>
    )},
    { key: 'charge', header: 'Charge ID', render: (item: Refund) => (
      <span className="font-mono text-xs">{String(item.charge).slice(0, 8)}</span>
    )},
    { key: 'amount', header: 'Amount', sortable: true, render: (item: Refund) => (
      <span className="font-medium">{item.amount.toFixed(2)}</span>
    )},
    { key: 'reason', header: 'Reason', render: (item: Refund) => (
      <p className="truncate max-w-[150px]">{item.reason}</p>
    )},
    { key: 'status', header: 'Status', render: (item: Refund) => (
      <Badge variant={REFUND_STATUS_COLORS[item.status] || 'default'}>
        {item.status}
      </Badge>
    )},
    { key: 'requestedByName', header: 'Requested By', render: (item: Refund) => item.requestedByName },
    { key: 'assignedToName', header: 'Assigned To', render: (item: Refund) => item.assignedToName || '-' },
    { key: 'createdAt', header: 'Created', sortable: true, render: (item: Refund) => new Date(item.createdAt).toLocaleDateString() },
  ]

  const handleResetFilters = () => {
    setSearch('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
          <p className="text-gray-500 mt-1">Manage and process refund requests</p>
        </div>
      </div>

      <FilterBar onReset={handleResetFilters} activeFilterCount={[status, dateFrom, dateTo, search].filter(Boolean).length}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
      </FilterBar>

      <BulkActions selectedCount={0} onClearSelection={() => {}} />

      {isLoading ? (
        <Loading />
      ) : refunds.length === 0 ? (
        <EmptyState icon={<Wallet className="h-12 w-12" />} title="No refunds found" description="No refund requests match your filters." />
      ) : (
        <>
          <DataTable data={refunds} columns={columns} keyExtractor={(item) => item.id} onRowClick={(item) => navigate(`/refunds/${item.id}`)} />
          <div className="bg-white rounded-xl border border-gray-200">
            <Pagination currentPage={page} totalPages={pagination?.total_pages ?? 1} totalItems={pagination?.total_count ?? 0} itemsPerPage={20} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
