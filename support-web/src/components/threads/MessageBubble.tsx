import { CheckCheck, FileText } from 'lucide-react'
import { formatSafeDate } from '@/utils/formatters'

interface MessageBubbleProps {
  content: string
  senderName: string
  senderRole: 'user' | 'support'
  timestamp: string
  isInternal?: boolean
  attachments?: string[]
  pending?: boolean
}

export const MessageBubble = ({
  content,
  senderName,
  senderRole,
  timestamp,
  isInternal = false,
  attachments = [],
  pending = false,
}: MessageBubbleProps) => {
  const fromCustomer = senderRole === 'user'

  return (
    <div className={`group flex gap-3 ${fromCustomer ? 'justify-start' : 'justify-end'}`}>
      {fromCustomer && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {(senderName || 'U').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className={`max-w-[82%] sm:max-w-[70%] ${fromCustomer ? '' : 'items-end'}`}>
        <div className={`mb-1 flex items-center gap-2 text-xs ${fromCustomer ? '' : 'justify-end'}`}>
          <span className="font-medium text-slate-700">{senderName}</span>
          <span className="text-slate-400">{formatSafeDate(timestamp, { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className={[
          'rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
          isInternal
            ? 'border border-amber-200 bg-amber-50 text-amber-950'
            : fromCustomer
              ? 'rounded-tl-md border border-slate-200 bg-white text-slate-800'
              : 'rounded-tr-md bg-slate-900 text-white',
          pending ? 'opacity-60' : '',
        ].join(' ')}>
          {isInternal && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Private staff note</p>}
          <p className="whitespace-pre-wrap break-words">{content}</p>
          {attachments.map((attachment) => (
            <a key={attachment} href={attachment} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs underline">
              <FileText className="h-4 w-4" /> View attachment
            </a>
          ))}
          {!fromCustomer && !isInternal && (
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-300">
              <CheckCheck className="h-3 w-3" /> {pending ? 'Sending…' : 'Sent'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
