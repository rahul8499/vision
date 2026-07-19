import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

interface InternalNoteFormData {
  content: string
}

interface InternalNoteFormProps {
  onSubmit: (content: string) => Promise<void>
  submitLabel?: string
}

export const InternalNoteForm = ({ onSubmit, submitLabel = 'Save private note' }: InternalNoteFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { register, handleSubmit, reset } = useForm<InternalNoteFormData>()

  const handleFormSubmit = async (data: InternalNoteFormData) => {
    if (!data.content.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit(data.content)
      reset()
    } catch {
      // handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex gap-2">
      <Input
        placeholder="Add a private note for the support team..."
        className="flex-1"
        {...register('content', { required: 'Note content is required' })}
      />
      <Button type="submit" size="sm" loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
