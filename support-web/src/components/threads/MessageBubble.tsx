import type { ReactNode } from 'react'

interface MessageBubbleProps {
  content: string
  senderName: string
  senderRole: 'user' | 'support'
  timestamp: string
  isInternal?: boolean
  attachments?: string[]
}

export const MessageBubble = ({ content, senderName, senderRole, timestamp, isInternal = false, attachments = [] }: MessageBubbleProps) => {
  const isUser = senderRole === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        {isInternal && (
          <div className="mb-1 px-2">
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">INTERNAL NOTE</span>
          </div>
        )}
        <div
          className={`rounded-lg px-4 py-2.5 ${
            isInternal
              ? 'bg-amber-50 border border-amber-200'
              : isUser
                ? 'bg-gray-100 text-gray-900'
                : 'bg-primary-600 text-white'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <span key={i} className="text-xs bg-black/10 px-2 py-1 rounded">
                  {att}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 px-1 flex items-center gap-2">
          <span className="text-xs text-gray-500">{senderName}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-400">{new Date(timestamp).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
