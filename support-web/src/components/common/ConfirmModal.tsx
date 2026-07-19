import { useState, useEffect } from 'react'
import { Button } from './Button'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (e?: React.FormEvent) => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  children?: React.ReactNode
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
  children,
}: ConfirmModalProps) => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) setIsLoading(false)
  }, [isOpen])

  const handleConfirm = async (e?: React.FormEvent) => {
    setIsLoading(true)
    try {
      await onConfirm(e)
      onClose()
    } catch {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        {children}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm} loading={isLoading || loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
