import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { safetyReportsApi } from '@/api/safetyReportsApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { DateRangeFilter } from '@/components/filters/DateRangeFilter'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useDebounce } from '@/hooks/useDebounce'
import { useCityStore } from '@/store/cityStore'
import type {
  ReporterType, SafetyReport, SafetyReportCategory, SafetyReportSeverity,
  SafetyReportStatus, SafetyScope, TargetType,
} from '@/types/safety'
import { SAFETY_REPORT_STATUS_COLORS, SAFETY_REPORT_SEVERITY_COLORS } from '@/types/safety'

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' }, { value: 'under_review', label: 'Under review' },
  { value: 'action_taken', label: 'Action taken' }, { value: 'escalated', label: 'Sent to senior team' },
  { value: 'closed', label: 'Closed' },
]
const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
]
const CATEGORY_OPTIONS = [
  { value: 'fake_or_spam', label: 'Fake or spam request' },
  { value: 'invalid_contact', label: 'Invalid contact information' },
  { value: 'wrong_information', label: 'Wrong information' },
  { value: 'suspicious_behavior', label: 'Suspicious behavior' },
  { value: 'medicine_safety', label: 'Medicine safety concern' },
  { value: 'abusive_behavior', label: 'Abusive behavior' },
  { value: 'other', label: 'Other' },
]
const TYPE_OPTIONS = [{ value: 'user', label: 'User' }, { value: 'store', label: 'Pharmacy' }]
const SCOPE_OPTIONS = [{ value: 'CITY', label: 'City operational' }, { value: 'GLOBAL', label: 'Global platform' }]
const ASSIGNMENT_OPTIONS = [{ value: 'unassigned', label: 'Unassigned only' }]
const label = (value: string) => value.replace(/_/g, ' ')

export const SafetyReportList = () => {
  const navigate = useNavigate()
  const city = useCityStore((state) => state.selectedCityId)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [reporterType, setReporterType] = useState('')
  const [targetType, setTargetType] = useState('')
  const [scope, setScope] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['safety-reports', page, debouncedSearch, status, severity, category, reporterType, targetType, scope, assignedTo, dateFrom, dateTo, city],
    queryFn: () => safetyReportsApi.getAll({
      page, limit: 20, search: debouncedSearch || undefined,
      status: status as SafetyReportStatus || undefined,
      severity: severity as SafetyReportSeverity || undefined,
      category: category as SafetyReportCategory || undefined,
      reporterType: reporterType as ReporterType || undefined,
      targetType: targetType as TargetType || undefined,
      scope: scope as SafetyScope || undefined,
      assignedTo: assignedTo || undefined,
      city: city || undefined,
      dateFrom: dateFrom?.toISOString().slice(0, 10),
      dateTo: dateTo?.toISOString().slice(0, 10),
    }),
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  const reports = data?.results ?? []
  const pagination = data?.pagination
  const reset = () => {
    setSearch(''); setStatus(''); setSeverity(''); setCategory(''); setReporterType('')
    setTargetType(''); setScope(''); setAssignedTo(''); setDateFrom(undefined); setDateTo(undefined); setPage(1)
  }
  const activeFilters = [search, status, severity, category, reporterType, targetType, scope, assignedTo, dateFrom, dateTo].filter(Boolean).length
  const columns = [
    { key: 'report', header: 'Report', render: (item: SafetyReport) => <div className="min-w-[210px]"><span className="font-mono text-xs text-slate-400">#{item.id}</span><p className="font-semibold capitalize text-slate-900">{label(item.category)}</p><p className="max-w-[260px] truncate text-xs text-slate-500">{item.description}</p></div> },
    { key: 'parties', header: 'Reported by / Against', render: (item: SafetyReport) => <div><p className="text-sm">{item.reporterName} <span className="text-slate-400">→</span> {item.reportedName}</p><p className="text-xs capitalize text-slate-500">{item.reporterType} → {item.targetType}</p></div> },
    { key: 'severity', header: 'How serious', render: (item: SafetyReport) => <Badge className={SAFETY_REPORT_SEVERITY_COLORS[item.severity]}>{item.severity}</Badge> },
    { key: 'status', header: 'Status', render: (item: SafetyReport) => <Badge className={SAFETY_REPORT_STATUS_COLORS[item.status]}>{label(item.status)}</Badge> },
    { key: 'scope', header: 'Area', render: (item: SafetyReport) => item.scope === 'GLOBAL' ? 'All cities' : (item.cityName || 'City not set') },
    { key: 'assigned', header: 'Assigned staff', render: (item: SafetyReport) => item.assignedToName || <span className="font-medium text-amber-700">Not assigned</span> },
    { key: 'created', header: 'Created', render: (item: SafetyReport) => new Date(item.createdAt).toLocaleString() },
  ]

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-950">Safety Issues</h1><p className="mt-1 text-sm text-slate-500">Review serious problems involving a user, store or medicine, record your findings and close the case safely.</p></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-[280px] flex-1">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search report, prescription, person…" />
        </div>
        <SelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={STATUS_OPTIONS} placeholder="All statuses" />
        <SelectFilter value={severity} onChange={(value) => { setSeverity(value); setPage(1) }} options={SEVERITY_OPTIONS} placeholder="All seriousness levels" />
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" /> More filters
          {activeFilters > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-xs text-white">{activeFilters}</span>}
          <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {activeFilters > 0 && <button type="button" onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-900">Clear all</button>}
      </div>
      {showAdvanced && <div className="border-t border-slate-100 bg-slate-50/70 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Advanced filters</p>
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter label="Category" value={category} onChange={(value) => { setCategory(value); setPage(1) }} options={CATEGORY_OPTIONS} />
          <SelectFilter label="Reporter" value={reporterType} onChange={(value) => { setReporterType(value); setPage(1) }} options={TYPE_OPTIONS} />
          <SelectFilter label="Reported party" value={targetType} onChange={(value) => { setTargetType(value); setPage(1) }} options={TYPE_OPTIONS} />
          <SelectFilter label="City coverage" value={scope} onChange={(value) => { setScope(value); setPage(1) }} options={SCOPE_OPTIONS} />
          <SelectFilter label="Assigned or not" value={assignedTo} onChange={(value) => { setAssignedTo(value); setPage(1) }} options={ASSIGNMENT_OPTIONS} />
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={(value) => { setDateFrom(value); setPage(1) }} onToChange={(value) => { setDateTo(value); setPage(1) }} />
        </div>
      </div>}
    </div>
    {isLoading ? <Loading /> : reports.length === 0 ? (
      <EmptyState icon={<ShieldAlert className="h-12 w-12" />} title="No safety reports found" description="No reports match the selected authorized city and filters." />
    ) : <>
      <DataTable data={reports} columns={columns} keyExtractor={(item) => item.id} onRowClick={(item) => navigate(`/safety-reports/${item.id}`)} />
      <div className="rounded-xl border border-slate-200 bg-white"><Pagination currentPage={page} totalPages={pagination?.total_pages ?? 1} totalItems={pagination?.total_count ?? 0} itemsPerPage={20} onPageChange={setPage} /></div>
    </>}
  </div>
}
