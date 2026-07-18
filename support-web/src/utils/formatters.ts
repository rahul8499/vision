import { format } from 'date-fns'
import { format as formatDateOnly } from 'date-fns'

export const formatDateRange = (start: Date | string, end: Date | string): string => {
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = typeof end === 'string' ? new Date(end) : end
  return `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`
}

export const formatRelativeDate = (date: string | Date): string => {
  const now = new Date()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  return format(dateObj, 'MMM dd, yyyy')
}

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export const formatOrderId = (id: string): string => {
  return `ORD-${id.slice(0, 8).toUpperCase()}`
}

export const formatId = (id: string): string => {
  return `#${id.slice(0, 8).toUpperCase()}`
}

export const formatSafeDate = (
  date?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!date) return 'Not available'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}
