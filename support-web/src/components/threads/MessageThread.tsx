import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MessageBubble } from './MessageBubble'
import { Button } from '@/components/common/Button'
import { Send, MessageCircle, Paperclip, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '@/api/operationsApi'

interface ThreadMessage {
  id: string | number
  content: string
  senderName: string
  senderRole: 'user' | 'support'
  createdAt: string
  isInternal?: boolean
  attachments?: string[]
  pending?: boolean
}

interface MessageThreadProps {
  messages: ThreadMessage[]
  onReply?: (content: string, attachment?: File) => void | Promise<void>
  replyPlaceholder?: string
  replyButtonLabel?: string
  showReplyForm?: boolean
  footer?: ReactNode
  isSending?: boolean
  draftKey?: string
}

export const MessageThread = ({
  messages,
  onReply,
  replyPlaceholder = 'Write a reply to the customer…',
  replyButtonLabel = 'Send reply',
  showReplyForm = true,
  footer,
  isSending = false,
  draftKey,
}: MessageThreadProps) => {
  const storageKey = draftKey ? `support-reply-draft:${draftKey}` : null
  const [replyText, setReplyText] = useState(() => storageKey ? localStorage.getItem(storageKey) || '' : '')
  const [attachment, setAttachment] = useState<File | undefined>()
  const repliesQuery = useQuery({ queryKey: ['saved-replies'], queryFn: operationsApi.getSavedReplies, staleTime: 300_000, enabled: showReplyForm })
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length])

  useEffect(() => {
    if (!storageKey) return
    if (replyText) localStorage.setItem(storageKey, replyText)
    else localStorage.removeItem(storageKey)
  }, [replyText, storageKey])

  useEffect(() => {
    setReplyText(storageKey ? localStorage.getItem(storageKey) || '' : '')
  }, [storageKey])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const content = replyText.trim()
    if ((!content && !attachment) || isSending) return
    setReplyText('')
    const selectedAttachment = attachment
    setAttachment(undefined)
    try {
      await onReply?.(content, selectedAttachment)
    } catch {
      setReplyText(content)
      setAttachment(selectedAttachment)
    }
  }

  return (
    <div className="flex min-h-[560px] flex-col">
      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <div className="flex h-72 flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-white p-3 shadow-sm"><MessageCircle className="h-6 w-6 text-slate-400" /></div>
            <p className="font-medium text-slate-700">No messages yet</p>
            <p className="mt-1 text-sm text-slate-500">Send the first reply for this case.</p>
          </div>
        )}
        {messages.map((message) => <MessageBubble key={message.id} {...message} timestamp={message.createdAt} />)}
        {footer}
        <div ref={endRef} />
      </div>
      {showReplyForm && onReply && (
        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
          <textarea
            rows={3}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={replyPlaceholder}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
          {attachment && <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="Remove attachment"><X className="h-3.5 w-3.5" /></button></div>}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600"><Paperclip className="h-3.5 w-3.5" />Attach file<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" className="hidden" onChange={event => setAttachment(event.target.files?.[0])} /></label><p className="text-xs text-slate-400">Maximum 10 MB</p>{repliesQuery.data?.length > 0 && <select aria-label="Use a ready reply" defaultValue="" onChange={event => { const selected = repliesQuery.data.find((item: any) => String(item.id) === event.target.value); if (selected) setReplyText(current => current ? `${current}\n${selected.body}` : selected.body); event.target.value = '' }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"><option value="" disabled>Use a ready reply…</option>{repliesQuery.data.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}</div>
            <Button type="submit" size="sm" loading={isSending} disabled={!replyText.trim() && !attachment} rightIcon={<Send className="h-3.5 w-3.5" />}>
              {replyButtonLabel}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
