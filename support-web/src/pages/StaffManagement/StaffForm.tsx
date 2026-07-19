import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { SelectFilter } from '@/components/filters/SelectFilter'
import toast from 'react-hot-toast'
import { staffApi } from '@/api/staffApi'
import type { UserRole } from '@/types/auth'
import type { StaffCreateRequest } from '@/types/staff'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { emergencyMonitoringApi } from '@/api/emergencyMonitoringApi'

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
]

export const StaffForm = () => {
  const navigate = useNavigate()
  const { register, handleSubmit, setValue } = useForm<StaffCreateRequest>({ defaultValues: { role: 'agent' } })
  const [role, setRole] = useState<UserRole>('agent')
  const [allCities, setAllCities] = useState(false)
  const [selectedCities, setSelectedCities] = useState<number[]>([])
  const citiesQuery = useQuery({ queryKey: ['staff-form-cities'], queryFn: emergencyMonitoringApi.getCities })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: StaffCreateRequest) => {
    setIsSubmitting(true)
    try {
      if (!allCities && selectedCities.length === 0) { toast.error('Select at least one city or enable All cities'); setIsSubmitting(false); return }
      await staffApi.create({ ...data, allCitiesAccess: allCities, cities: selectedCities })
      toast.success('Staff member created successfully')
      navigate('/staff')
    } catch {
      toast.error('Failed to create staff member')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Staff Member</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" {...register('name', { required: 'Name is required' })} />
          <Input label="Employee ID" {...register('employeeId', { required: 'Employee ID is required' })} />
        </div>
        <Input label="Email" type="email" {...register('email', { required: 'Email is required' })} />
        <Input label="Password" type="password" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })} />
        <SelectFilter
          label="Role"
          value={role}
          onChange={(value) => { setRole(value as UserRole); setValue('role', value as UserRole) }}
          options={ROLE_OPTIONS}
        />
        <Input label="Department" {...register('department')} />
        <Input label="Phone" {...register('phone')} />
        <div className="rounded-xl border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={allCities} onChange={e => setAllCities(e.target.checked)} />All cities access</label>
          {!allCities && <div className="mt-3 grid grid-cols-2 gap-2">{(citiesQuery.data || []).map(city => <label key={city.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCities.includes(city.id)} onChange={e => setSelectedCities(e.target.checked ? [...selectedCities, city.id] : selectedCities.filter(id => id !== city.id))} />{city.name}</label>)}</div>}
          <p className="mt-2 text-xs text-gray-500">Agents only see operational records from assigned cities. Admin can use All cities.</p>
        </div>
        <Button type="submit" loading={isSubmitting}>Create Staff Member</Button>
      </form>
    </div>
  )
}
