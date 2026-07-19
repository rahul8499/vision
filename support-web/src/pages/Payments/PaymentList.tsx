import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, CreditCard, Radio, Search } from 'lucide-react'
import { paymentsApi } from '@/api/paymentsApi'
import { PaymentTabs } from '@/components/payments/PaymentTabs'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { Badge } from '@/components/common/Badge'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaymentRecord, PaymentSource } from '@/types/payments'
import { useCityStore } from '@/store/cityStore'

const badgeVariant = (status: string) => {
  if (['paid', 'captured', 'refunded'].includes(status)) return 'success' as const
  if (['pending', 'refund_pending'].includes(status)) return 'warning' as const
  if (['failed', 'refund_failed'].includes(status)) return 'danger' as const
  return 'default' as const
}

export const PaymentList = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<PaymentSource | ''>('')
  const debouncedSearch = useDebounce(search, 300)
  const city = useCityStore((state) => state.selectedCityId)
  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, debouncedSearch, source, city],
    queryFn: () => paymentsApi.getAll({ page, pageSize: 20, search: debouncedSearch, source, city: city || undefined }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const columns = [
    { key: 'paymentId', header: 'Payment ID', render: (item: PaymentRecord) => (
      <span className="font-mono text-xs text-slate-600">{item.paymentId || 'Not captured'}</span>
    )},
    { key: 'source', header: 'Payment for', render: (item: PaymentRecord) => item.sourceDisplay },
    { key: 'customerName', header: 'Customer', render: (item: PaymentRecord) => (
      <div><p className="font-medium text-slate-800">{item.customerName || 'Unknown'}</p><p className="text-xs capitalize text-slate-400">{item.customerType}</p></div>
    )},
    { key: 'city', header: 'City', render: (item: PaymentRecord) => item.cityName || 'Unassigned' },
    { key: 'amount', header: 'Amount', render: (item: PaymentRecord) => (
      <span className="font-semibold">{item.currency === 'INR' ? '₹' : item.currency} {item.amount.toFixed(2)}</span>
    )},
    { key: 'status', header: 'Payment status', render: (item: PaymentRecord) => (
      <Badge variant={badgeVariant(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'operationalStatus', header: 'Service progress', render: (item: PaymentRecord) => item.operationalStatusDisplay || '—' },
    { key: 'createdAt', header: 'Created', render: (item: PaymentRecord) => new Date(item.createdAt).toLocaleString() },
  ]

  const summary = data?.summary
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-bold text-slate-950">Payments</h1><p className="mt-1 text-sm text-slate-500">View customer payments for emergency requests and store plans. Payment records cannot be edited here.</p></div>
        <PaymentTabs />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<CreditCard />} label="Payments shown" value={summary?.totalPayments ?? 0} />
        <Metric icon={<Radio />} label="Emergency search running" value={summary?.broadcasting ?? 0} />
        <Metric icon={<CheckCircle2 />} label="Service delivered" value={summary?.serviceDelivered ?? 0} />
        <Metric icon={<Activity />} label="Refund pending" value={summary?.refundPending ?? 0} />
        <Metric icon={<AlertTriangle />} label="Refund failed" value={summary?.refundFailed ?? 0} danger />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search payment ID, customer, order or reference…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-200" />
        </label>
        <select value={source} onChange={(event) => { setSource(event.target.value as PaymentSource | ''); setPage(1) }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="">All payment sources</option>
          <option value="emergency_broadcast">Emergency broadcast</option>
          <option value="store_subscription">Store subscription</option>
        </select>
      </div>

      {isLoading ? <Loading /> : !data?.results.length ? (
        <EmptyState icon={<CreditCard className="h-12 w-12" />} title="No payments found" description="No payment records match the selected filters." />
      ) : (
        <>
          <DataTable data={data.results} columns={columns} keyExtractor={(item) => item.id} />
          <div className="rounded-xl border border-slate-200 bg-white">
            <Pagination currentPage={page} totalPages={data.pagination.totalPages} totalItems={data.pagination.totalCount} itemsPerPage={data.pagination.pageSize} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}

const Metric = ({ icon, label, value, danger = false }: { icon: React.ReactElement; label: string; value: number; danger?: boolean }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`rounded-lg p-2 [&_svg]:h-4 [&_svg]:w-4 ${danger && value ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{icon}</div>
    <div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div>
  </div>
)
