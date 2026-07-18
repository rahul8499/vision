import { useState, type ReactNode } from 'react'
import { MessageBubble } from './MessageBubble'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'

interface MessageThreadProps {
  messages: Array<{
    id: string
    content: string
    senderName: string
    senderRole: 'user' | 'support'
    createdAt: string
    isInternal?: boolean
    attachments?: string[]
  }>
  onReply?: (content: string) => void
  replyPlaceholder?: string
  replyButtonLabel?: string
  showReplyForm?: boolean
  footer?: ReactNode
}

export const MessageThread = ({
  messages,
  onReply,
  replyPlaceholder = 'Write a reply...',
  replyButtonLabel = 'Send',
  showReplyForm = true,
  footer,
}: MessageThreadProps) => {
  const [replyText, setReplyText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    onReply?.(replyText)
    setReplyText('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} {...msg} timestamp={msg.createdAt} />
        ))}
        {footer}
      </div>
      {showReplyForm && onReply && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-200">
          <Input
            as="textarea"
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={replyPlaceholder}
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" disabled={!replyText.trim()}>
              {replyButtonLabel}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
