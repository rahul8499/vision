import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Short plain-language explanation shown on hover and keyboard focus. */
  helpText?: string
}

const ACTION_HELP: Record<string, string> = {
  'save': 'Save this information.',
  'cancel': 'Close without saving.',
  'update': 'Save the new changes.',
  'search': 'Find matching records.',
  'show all results': 'Clear filters and show everything.',
  'choose who will handle this': 'Choose the staff member who will work on this case.',
  'give to this staff member': 'Give this case to the selected staff member.',
  'i will handle this': 'Give this case to me.',
  'save current stage': 'Save where this case has reached.',
  'save current progress': 'Save where this case has reached.',
  'save private note': 'Save a note only support staff can see.',
  'send reply': 'Send this message to the customer.',
  'approve this request': 'Allow this request.',
  'reject this request': 'Do not allow this request.',
  'approve this refund': 'Allow this refund.',
  'reject this refund': 'Do not allow this refund.',
  'send the approved refund': 'Send the approved money back.',
  'create a new password': 'Set a new password for this staff member.',
  'stop this staff account': 'Stop this staff member from signing in.',
  'allow this staff account': 'Let this staff member sign in again.',
  'create support staff account': 'Add a new support staff member.',
  'download report': 'Save this report on your device.',
  'mark every alert as read': 'Mark all alerts as already seen.',
  'open this completed case again': 'Open this case for more work. Its old history stays safe.',
}

const buttonLabel = (children: React.ReactNode) => typeof children === 'string' ? children.trim() : ''

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, helpText, children, className = '', disabled, title, ...props }, ref) => {
    const label = buttonLabel(children)
    const explanation = helpText || title || ACTION_HELP[label.toLowerCase()] || (label ? `Click to ${label.toLowerCase()}.` : undefined)
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'group relative inline-flex items-center justify-center gap-2 font-medium rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          variantStyles[variant],
          sizeStyles[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
        {explanation && (
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-3 hidden w-max max-w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/95 px-3.5 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-[0_14px_38px_rgba(15,23,42,0.28)] backdrop-blur-md group-hover:block group-focus-visible:block">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-300">What this does</span>
            <span className="mt-0.5 block">{explanation}</span>
            <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-white/10 bg-slate-950" />
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
