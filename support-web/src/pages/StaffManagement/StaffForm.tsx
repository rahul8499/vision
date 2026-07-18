import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { SelectFilter } from '@/components/filters/SelectFilter'
import toast from 'react-hot-toast'
import { staffApi } from '@/api/staffApi'
import type { UserRole } from '@/types/auth'
import type { StaffCreateRequest } from '@/types/staff'

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
]

export const StaffForm = () => {
  const { register, handleSubmit, reset } = useForm<StaffCreateRequest>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: StaffCreateRequest) => {
    setIsSubmitting(true)
    try {
      await staffApi.create(data)
      toast.success('Staff member created successfully')
      reset()
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
        <Input label="Password" type="password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} />
        <SelectFilter
          label="Role"
          value=""
          onChange={(value) => register('role').onChange({ target: { value: value as UserRole } })}
          options={ROLE_OPTIONS}
        />
        <Input label="Department" {...register('department')} />
        <Input label="Phone" {...register('phone')} />
        <Button type="submit" loading={isSubmitting}>Create Staff Member</Button>
      </form>
    </div>
  )
}
