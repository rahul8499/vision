import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lookupApi } from '@/api/lookupApi'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { ArrowLeft, Mail, Phone, MapPin, ShoppingBag, FileText, Ticket, AlertTriangle, DollarSign, Shield, Search } from 'lucide-react'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  processing: 'bg-purple-100 text-purple-800',
  locked: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  dismissed: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-800',
}

export const UserProfile = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [prescriptionSearch, setPrescriptionSearch] = useState('')
  const [prescriptionFilter, setPrescriptionFilter] = useState('all')
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quoteFilter, setQuoteFilter] = useState('all')

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => lookupApi.getUserProfile(id!),
    enabled: !!id,
    staleTime: 60000,
  })

  const prescriptions = profile?.prescriptions ?? []
  const orders = profile?.orders ?? []

  const prescriptionRows = useMemo(() => {
    const query = prescriptionSearch.toLowerCase()
    return prescriptions.filter((item) => {
      const matchesSearch = !query || [item.medicineName, item.description, item.targetStores.map((store) => store.name).join(' ')].join(' ').toLowerCase().includes(query)
      const matchesFilter = prescriptionFilter === 'all' || item.status === prescriptionFilter || (prescriptionFilter === 'ai_ready' && item.extractedMedicines.length > 0)
      return matchesSearch && matchesFilter
    })
  }, [prescriptions, prescriptionFilter, prescriptionSearch])

  const quoteRows = useMemo(() => {
    const query = quoteSearch.toLowerCase()
    return orders.filter((item) => {
      const matchesSearch = !query || [item.storeName, item.userStatus, item.deliveryOption].join(' ').toLowerCase().includes(query)
      const matchesFilter = quoteFilter === 'all' || item.userStatus === quoteFilter
      return matchesSearch && matchesFilter
    })
  }, [orders, quoteFilter, quoteSearch])

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!profile) return <ErrorState title="User not found" />

  return (
    <div className="space-y-4 max-w-6xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/user-lookup')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-gray-500">{profile.email}</p>
        </div>
        <Badge variant={profile.isActive ? 'success' : 'danger'}>
          {profile.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="User details">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{profile.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{profile.mobile}</p>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{profile.address}, {profile.pincode}</p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <Badge variant={profile.isVerified ? 'success' : 'warning'}>{profile.isVerified ? 'Verified' : 'Unverified'}</Badge>
            </div>
          </div>
        </Card>

        <Card title="Quick summary">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{profile.orders.length} orders</p>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{profile.prescriptions.length} prescriptions</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{profile.complaints.length} complaints</p>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{profile.tickets.length} tickets</p>
            </div>
          </div>
        </Card>
      </div>

      {profile.orders.length > 0 && (
        <Card title="Orders and quotes">
          <div className="mb-3 flex flex-col gap-2 md:flex-row">
            <SearchInput value={quoteSearch} onChange={setQuoteSearch} placeholder="Search store or status" className="md:max-w-xs" />
            <SelectFilter value={quoteFilter} onChange={setQuoteFilter} options={[{ value: 'all', label: 'All statuses' }, { value: 'quoted', label: 'Quoted' }, { value: 'accepted', label: 'Accepted' }, { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' }]} placeholder="Filter" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Order ID</th>
                  <th className="text-left py-2 px-3">Store</th>
                  <th className="text-left py-2 px-3">Amount</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {quoteRows.slice(0, 20).map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{order.id}</td>
                    <td className="py-2 px-3">{order.storeName}</td>
                    <td className="py-2 px-3">₹{order.totalAmount?.toFixed(2)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusColors[order.userStatus] || 'bg-gray-100 text-gray-800'}`}>
                        {order.userStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {quoteRows.length === 0 && <div className="mt-3 text-sm text-gray-500">No quote or order activity matches the current filters.</div>}
        </Card>
      )}

      {profile.prescriptions.length > 0 && (
        <Card title="Medicine requests">
          <div className="mb-3 flex flex-col gap-2 md:flex-row">
            <SearchInput value={prescriptionSearch} onChange={setPrescriptionSearch} placeholder="Search prescription, store, or note" className="md:max-w-xs" />
            <SelectFilter value={prescriptionFilter} onChange={setPrescriptionFilter} options={[{ value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'quoted', label: 'Quoted' }, { value: 'accepted', label: 'Accepted' }, { value: 'ai_ready', label: 'AI suggestions ready' }]} placeholder="Filter" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Medicine</th>
                  <th className="text-left py-2 px-3">Stores asked</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">AI</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {prescriptionRows.slice(0, 20).map((rx) => (
                  <tr key={rx.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{rx.id}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{rx.medicineName || 'N/A'}</div>
                      {rx.description ? <div className="text-xs text-gray-500">{rx.description}</div> : null}
                    </td>
                    <td className="py-2 px-3">{rx.targetStores.map(s => s.name).join(', ') || '-'}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-1 rounded-full text-xs ${statusColors[rx.status] || 'bg-gray-100 text-gray-800'}`}>{rx.status}</span></td>
                    <td className="py-2 px-3">{rx.extractedMedicines.length > 0 ? `${rx.extractedMedicines.length} suggestions` : 'None'}</td>
                    <td className="py-2 px-3">{new Date(rx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prescriptionRows.length === 0 && <div className="mt-3 text-sm text-gray-500">No prescriptions match the current filters.</div>}
        </Card>
      )}

      {profile.complaints.length > 0 && (
        <Card title="Complaints">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Subject</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.complaints.slice(0, 20).map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/complaints/${c.id}`)} className="cursor-pointer border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{c.id}</td>
                    <td className="py-2 px-3">{c.category}</td>
                    <td className="py-2 px-3">{c.subject}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{c.status}</span>
                    </td>
                    <td className="py-2 px-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {profile.tickets.length > 0 && (
        <Card title="Help Requests">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Subject</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {profile.tickets.slice(0, 20).map((t) => (
                  <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="cursor-pointer border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{t.id}</td>
                    <td className="py-2 px-3">{t.category}</td>
                    <td className="py-2 px-3">{t.subject}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{t.status}</span>
                    </td>
                    <td className="py-2 px-3">{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {profile.refunds.length > 0 && (
        <Card title="Refunds">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Amount</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Reason</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.refunds.slice(0, 20).map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/refunds/${r.id}`)} className="cursor-pointer border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{r.id}</td>
                    <td className="py-2 px-3">₹{r.amount.toFixed(2)}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{r.status}</span>
                    </td>
                    <td className="py-2 px-3">{r.reason}</td>
                    <td className="py-2 px-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {profile.safetyReportsFiled.length > 0 && (
        <Card title="Safety issues reported by this user">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Reason</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.safetyReportsFiled.slice(0, 20).map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/safety-reports/${r.id}`)} className="cursor-pointer border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{r.id}</td>
                    <td className="py-2 px-3">{r.reason}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{r.status}</span>
                    </td>
                    <td className="py-2 px-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {profile.safetyReportsAgainst.length > 0 && (
        <Card title="Safety issues reported against this user">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Reason</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Reported By</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.safetyReportsAgainst.slice(0, 20).map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/safety-reports/${r.id}`)} className="cursor-pointer border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{r.id}</td>
                    <td className="py-2 px-3">{r.reason}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{r.status}</span>
                    </td>
                    <td className="py-2 px-3">{r.reportedBy?.name || '-'}</td>
                    <td className="py-2 px-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
