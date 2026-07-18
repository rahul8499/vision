import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/authApi'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Loading } from '@/components/common/Loading'
import toast from 'react-hot-toast'
import type { User } from '@/types/auth'

export const SettingsPage = () => {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.me(),
    staleTime: 30000,
  })

  const { register, handleSubmit, formState: { isDirty, isSubmitting } } = useForm<Partial<User>>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || '',
      timezone: user?.timezone || '',
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<User>) => authApi.updateProfile(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['current-user'] }),
  })

  const onSubmit = async (data: Partial<User>) => {
    try {
      await updateProfileMutation.mutateAsync(data)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Card title="Profile Information">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Full Name" {...register('name')} />
          <Input label="Email" type="email" {...register('email')} />
          <Input label="Phone" {...register('phone')} />
          <Input label="Department" {...register('department')} />
          <Input label="Timezone" {...register('timezone')} />
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">Update your profile information</p>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Change Password">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <Input label="Current Password" type="password" />
          <Input label="New Password" type="password" />
          <Input label="Confirm New Password" type="password" />
          <div className="flex justify-end">
            <Button>Change Password</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
