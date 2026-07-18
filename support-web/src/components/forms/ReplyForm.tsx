import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import toast from 'react-hot-toast'

interface ReplyFormData {
  content: string
}

interface ReplyFormProps {
  onSubmit: (content: string, attachments?: string[]) => Promise<void>
  placeholder?: string
  submitLabel?: string
}

export const ReplyForm = ({ onSubmit, placeholder = 'Type your reply...', submitLabel = 'Send Reply' }: ReplyFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReplyFormData>()

  const handleFormSubmit = async (data: ReplyFormData) => {
    if (!data.content.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit(data.content, attachments)
      reset()
      setAttachments([])
      toast.success('Reply sent successfully')
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
      <Input
        as="textarea"
        rows={3}
        placeholder={placeholder}
        error={errors.content?.message}
        {...register('content', { required: 'Reply content is required' })}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {attachments.map((att, i) => (
            <span key={i} className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {att}
            </span>
          ))}
        </div>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
