import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { staffApi } from '@/api/staffApi'
import { ROLE_LABELS } from '@/types/auth'
import { emergencyMonitoringApi } from '@/api/emergencyMonitoringApi'

export const StaffDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [allCities, setAllCities] = useState(false)
  const [cityIds, setCityIds] = useState<number[]>([])

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffApi.getOne(id!),
    enabled: !!id,
    staleTime: 60000,
  })
  const citiesQuery = useQuery({ queryKey: ['staff-cities'], queryFn: emergencyMonitoringApi.getCities })
  useEffect(() => { if (staff) { setAllCities(!!staff.allCitiesAccess); setCityIds(staff.cityIds || []) } }, [staff])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] })
  const statusMutation = useMutation({ mutationFn: async (): Promise<void> => {
    if (!staff) throw new Error('Staff not loaded')
    if (staff.status === 'active') await staffApi.delete(staff.id)
    else await staffApi.activate(staff.id)
  }, onSuccess: () => { const wasActive = staff?.status === 'active'; refresh(); toast.success(wasActive ? 'Staff deactivated' : 'Staff activated') }, onError: () => toast.error('Staff status could not be changed') })
  const cityMutation = useMutation({ mutationFn: () => staffApi.update(id!, { allCitiesAccess: allCities, cities: allCities ? [] : cityIds }), onSuccess: () => { refresh(); toast.success('City access updated') }, onError: () => toast.error('City access could not be updated') })

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!staff) return <ErrorState title="Staff member not found" />
  const resetPassword = async () => {
    const password = window.prompt('Enter a temporary password (minimum 8 characters)')
    if (!password || password.length < 8) return password ? toast.error('Password must contain at least 8 characters') : undefined
    try { await staffApi.resetPassword(staff.id, password); toast.success('Temporary password updated') } catch { toast.error('Password reset failed') }
  }

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
        <div className="ml-auto flex gap-2"><Button variant="secondary" onClick={resetPassword}>Create a new password</Button><Button variant={staff.status === 'active' ? 'danger' : 'primary'} loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>{staff.status === 'active' ? 'Stop this staff account' : 'Allow this staff account'}</Button></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Staff details">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Access level</p>
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
        <Card title="What this person can access">
          <div className="flex flex-wrap gap-2">
            {staff.permissions.length > 0 ? (
              staff.permissions.map((perm) => (
                <span key={perm} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{perm}</span>
              ))
            ) : (
              <p className="text-sm text-gray-500">Available actions are based on this person's access level.</p>
            )}
          </div>
        </Card>
        <Card title="Cities this person can work in">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={allCities} onChange={e => setAllCities(e.target.checked)} />All cities</label>
          {!allCities && <div className="mt-3 grid grid-cols-2 gap-2">{(citiesQuery.data || []).map(city => <label key={city.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cityIds.includes(city.id)} onChange={e => setCityIds(e.target.checked ? [...cityIds, city.id] : cityIds.filter(value => value !== city.id))} />{city.name}</label>)}</div>}
          <Button size="sm" className="mt-3" disabled={!allCities && cityIds.length === 0} loading={cityMutation.isPending} onClick={() => cityMutation.mutate()}>Save cities this staff member can access</Button>
        </Card>
      </div>
    </div>
  )
}
