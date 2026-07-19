import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useQuery } from '@tanstack/react-query'
import { staffApi } from '@/api/staffApi'
import { ROLE_LABELS } from '@/types/auth'

export const StaffDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffApi.getOne(id!),
    enabled: !!id,
    staleTime: 60000,
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!staff) return <ErrorState title="Staff member not found" />

  return (
    <div className="space-y-4 max-w-4xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/staff')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
          <p className="text-gray-500">{staff.email}</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          staff.status === 'active' ? 'bg-green-100 text-green-800' : staff.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {staff.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Role Information">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm font-medium">{ROLE_LABELS[staff.role] || staff.role}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Department</p>
              <p className="text-sm">{staff.department || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Joined</p>
              <p className="text-sm">{new Date(staff.createdAt).toLocaleDateString()}</p>
            </div>
            {staff.lastLoginAt && (
              <div>
                <p className="text-xs text-gray-500">Last Login</p>
                <p className="text-sm">{new Date(staff.lastLoginAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </Card>
        <Card title="Permissions">
          <div className="flex flex-wrap gap-2">
            {staff.permissions.length > 0 ? (
              staff.permissions.map((perm) => (
                <span key={perm} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{perm}</span>
              ))
            ) : (
              <p className="text-sm text-gray-500">Access is determined by the staff role.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
