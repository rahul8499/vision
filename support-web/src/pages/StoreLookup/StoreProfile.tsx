import { useQuery } from '@tanstack/react-query'
import { lookupApi } from '@/api/lookupApi'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ArrowLeft, Mail, Phone, MapPin, Star, ShoppingBag, FileText, AlertTriangle, DollarSign, Shield, Clock } from 'lucide-react'

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

export const StoreProfile = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: store, isLoading, error } = useQuery({
    queryKey: ['store-profile', id],
    queryFn: () => lookupApi.getStoreProfile(id!),
    enabled: !!id,
    staleTime: 60000,
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!store) return <ErrorState title="Store not found" />

  return (
    <div className="space-y-4 max-w-6xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/store-lookup')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
          <p className="text-gray-500">{store.address}, {store.pincode}</p>
        </div>
        <Badge variant={store.isActive ? 'success' : 'danger'}>
          {store.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <Badge variant={store.isVerified ? 'success' : 'warning'}>
          {store.isVerified ? 'Verified' : 'Unverified'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Store details">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{store.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{store.mobile}</p>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{store.address}, {store.pincode}</p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <p className="text-sm">Owner: {store.ownerName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-sm">{store.averageRating.toFixed(1)} ({store.totalRatings} ratings)</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm">Avg response: {store.avgResponseTimeMins} mins</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={store.autoAcceptPrescription ? 'success' : 'default'}>
                {store.autoAcceptPrescription ? 'Auto-accept ON' : 'Auto-accept OFF'}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="Store performance summary">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{store.performanceMetrics.totalOrders} total orders</p>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium">{store.performanceMetrics.completedOrders} completed</p>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-red-500" />
              <p className="text-sm font-medium">{store.performanceMetrics.cancellationRate}% cancellation rate</p>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{store.performanceMetrics.prescriptionAcceptanceRate}% prescription acceptance</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{store.performanceMetrics.complaintCount} complaints</p>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium">{store.performanceMetrics.refundCount} refunds</p>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-medium">{store.performanceMetrics.averageRating.toFixed(1)} avg rating</p>
            </div>
          </div>
        </Card>
      </div>

      {store.orders.length > 0 && (
        <Card title="Orders">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Order ID</th>
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Amount</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {store.orders.slice(0, 20).map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{order.id}</td>
                    <td className="py-2 px-3">{order.userName}</td>
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
        </Card>
      )}

      {store.prescriptionsReceived.length > 0 && (
        <Card title="Medicine requests received">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Target ID</th>
                  <th className="text-left py-2 px-3">Prescription ID</th>
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {store.prescriptionsReceived.slice(0, 20).map((rx) => (
                  <tr key={rx.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{rx.id}</td>
                    <td className="py-2 px-3">#{rx.prescriptionId}</td>
                    <td className="py-2 px-3">{rx.userName || 'N/A'}</td>
                    <td className="py-2 px-3">{new Date(rx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {store.quotesSubmitted.length > 0 && (
        <Card title="Price offers sent">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Response ID</th>
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Amount</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {store.quotesSubmitted.slice(0, 20).map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">#{order.id}</td>
                    <td className="py-2 px-3">{order.userName}</td>
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
        </Card>
      )}

      {store.complaints.length > 0 && (
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
                {store.complaints.slice(0, 20).map((c) => (
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

      {store.safetyReports.length > 0 && (
        <Card title="Safety issues">
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
                {store.safetyReports.slice(0, 20).map((r) => (
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

      {store.refunds.length > 0 && (
        <Card title="Refund requests">
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
                {store.refunds.slice(0, 20).map((r) => (
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
    </div>
  )
}
