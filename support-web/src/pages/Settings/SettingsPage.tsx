import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/authApi'
import { useEffect, useState } from 'react'
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

  const profileForm = useForm<Partial<User>>()
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name, email: user.email, phone: user.phone || '', department: user.department || '', timezone: user.timezone || '' })
  }, [user, profileForm])

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

  const changePassword = async () => {
    if (passwords.next.length < 8) return toast.error('New password must be at least 8 characters')
    if (passwords.next !== passwords.confirm) return toast.error('New passwords do not match')
    try {
      await authApi.changePassword({ old_password: passwords.current, new_password: passwords.next })
      setPasswords({ current: '', next: '', confirm: '' })
      toast.success('Password changed. Please sign in again if your session ends.')
    } catch { toast.error('Could not change password. Check your current password.') }
  }

  if (isLoading) return <Loading />

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Account Settings</h1>

      <Card title="My details">
        <form onSubmit={profileForm.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Full Name" {...profileForm.register('name', { required: true })} />
          <Input label="Email" type="email" {...profileForm.register('email', { required: true })} />
          <Input label="Phone" {...profileForm.register('phone')} />
          <Input label="Department" {...profileForm.register('department')} />
          <Input label="Timezone" {...profileForm.register('timezone')} />
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">Update your profile information</p>
            <Button type="submit" loading={profileForm.formState.isSubmitting} disabled={!profileForm.formState.isDirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Change Password">
        <form onSubmit={(e) => { e.preventDefault(); changePassword() }} className="space-y-4">
          <Input label="Current Password" type="password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} required />
          <Input label="New Password" type="password" value={passwords.next} onChange={e => setPasswords({ ...passwords, next: e.target.value })} minLength={8} required />
          <Input label="Confirm New Password" type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} minLength={8} required />
          <div className="flex justify-end">
            <Button type="submit" disabled={!passwords.current || !passwords.next || !passwords.confirm}>Change Password</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
