import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { safetyReportsApi } from '@/api/safetyReportsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { DateRangeFilter } from '@/components/filters/DateRangeFilter'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import type { SafetyReport, SafetyReportStatus, SafetyReportSeverity, SafetyReportCategory } from '@/types/safety'
import { SAFETY_REPORT_STATUS_COLORS, SAFETY_REPORT_SEVERITY_COLORS } from '@/types/safety'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const CATEGORY_OPTIONS = [
  { value: 'food_poisoning', label: 'Food Poisoning' },
  { value: 'allergen', label: 'Allergen' },
  { value: 'physical_hazard', label: 'Physical Hazard' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'other', label: 'Other' },
]

export const SafetyReportList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['safety-reports', page, debouncedSearch, status, severity, category, dateFrom, dateTo],
    queryFn: () => safetyReportsApi.getAll({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status as SafetyReportStatus) || undefined,
      severity: (severity as SafetyReportSeverity) || undefined,
      category: (category as SafetyReportCategory) || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    staleTime: 30000,
  })

  const reports = data?.results ?? []
  const pagination = data?.pagination

  const columns = [
    { key: 'id', header: 'Report ID', render: (item: SafetyReport) => (
      <span className="font-mono text-xs text-gray-500">#{String(item.id).slice(0, 8)}</span>
    )},
    { key: 'category', header: 'Subject', render: (item: SafetyReport) => (
      <div>
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{item.category.replace('_', ' ')}</p>
        <p className="text-xs text-gray-500">{item.reporterName}</p>
      </div>
    )},
    { key: 'reportedName', header: 'Reported Entity', render: (item: SafetyReport) => item.reportedName },
    { key: 'category', header: 'Category', render: (item: SafetyReport) => item.category.replace('_', ' ') },
    { key: 'severity', header: 'Severity', render: (item: SafetyReport) => (
      <Badge variant={SAFETY_REPORT_SEVERITY_COLORS[item.severity] || 'default'}>
        {item.severity}
      </Badge>
    )},
    { key: 'status', header: 'Status', render: (item: SafetyReport) => (
      <Badge variant={SAFETY_REPORT_STATUS_COLORS[item.status] || 'default'}>
        {item.status.replace('_', ' ')}
      </Badge>
    )},
    { key: 'assignedToName', header: 'Assigned To', render: (item: SafetyReport) => item.assignedToName || '-' },
    { key: 'createdAt', header: 'Created', sortable: true, render: (item: SafetyReport) => new Date(item.createdAt).toLocaleDateString() },
  ]

  const handleResetFilters = () => {
    setSearch('')
    setStatus('')
    setSeverity('')
    setCategory('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safety Reports</h1>
          <p className="text-gray-500 mt-1">Monitor and resolve safety concerns</p>
        </div>
      </div>

      <FilterBar onReset={handleResetFilters} activeFiltersCount={[status, severity, category, dateFrom, dateTo, search].filter(Boolean).length}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectFilter label="Severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
      </FilterBar>

      {isLoading ? (
        <Loading />
      ) : reports.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="h-12 w-12" />} title="No safety reports found" description="No safety reports match your filters." />
      ) : (
        <>
          <DataTable data={reports} columns={columns} keyExtractor={(item) => item.id} onRowClick={(item) => navigate(`/safety-reports/${item.id}`)} />
          <div className="bg-white rounded-xl border border-gray-200">
            <Pagination currentPage={page} totalPages={pagination?.total_pages ?? 1} totalItems={pagination?.total_count ?? 0} itemsPerPage={20} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
