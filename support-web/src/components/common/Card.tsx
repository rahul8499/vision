import { type ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  onClick?: () => void
}

export const Card = ({ title, subtitle, actions, children, className = '', onClick }: CardProps) => {
  return (
    <div onClick={onClick} className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className} ${onClick ? 'cursor-pointer' : ''}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
