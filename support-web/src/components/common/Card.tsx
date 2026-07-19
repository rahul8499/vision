import { type ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  onClick?: () => void
  helpText?: string
}

export const Card = ({ title, subtitle, actions, children, className = '', onClick, helpText }: CardProps) => {
  const explanation = helpText || subtitle || (title ? `Here you can see ${title.toLowerCase()}.` : '')
  return (
    <div onClick={onClick} className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className} ${onClick ? 'cursor-pointer' : ''}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            {title && <div className="flex items-center gap-2"><h3 className="text-lg font-semibold text-gray-900">{title}</h3>{explanation && <span tabIndex={0} role="img" aria-label={`About this section: ${explanation}`} className="group relative inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 text-[11px] font-bold text-sky-700 shadow-sm outline-none transition hover:border-sky-300 hover:shadow focus:ring-2 focus:ring-sky-300">?<span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-3 hidden w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/95 px-3.5 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-[0_14px_38px_rgba(15,23,42,0.28)] backdrop-blur-md group-hover:block group-focus:block"><span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-300">About this section</span><span className="mt-0.5 block">{explanation}</span><span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-white/10 bg-slate-950" /></span></span>}</div>}
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
