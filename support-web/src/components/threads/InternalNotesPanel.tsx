import type { ReactNode } from 'react'
import { Input } from '@/components/common/Input'
import { InternalNoteForm } from '@/components/forms/InternalNoteForm'
import { Button } from '@/components/common/Button'

interface InternalNotesPanelProps {
  notes: Array<{
    id: string
    content: string
    authorName: string
    createdAt: string
  }>
  onAddNote: (content: string) => Promise<void>
  title?: string
  footer?: ReactNode
}

export const InternalNotesPanel = ({ notes, onAddNote, title = 'Internal Notes', footer }: InternalNotesPanelProps) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No internal notes yet</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">{note.content}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">{note.authorName}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">{new Date(note.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
        {footer}
      </div>
      <div className="p-4 border-t border-gray-200">
        <InternalNoteForm onSubmit={onAddNote} />
      </div>
    </div>
  )
}
