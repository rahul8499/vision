import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { complaintsApi } from '@/api/complaintsApi'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageThread } from '@/components/threads/MessageThread'
import { InternalNotesPanel } from '@/components/threads/InternalNotesPanel'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ReplyForm } from '@/components/forms/ReplyForm'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ArrowLeft, User, Store, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Complaint, ComplaintStatus, ComplaintPriority } from '@/types/complaints'
import { COMPLAINT_STATUS_COLORS, COMPLAINT_PRIORITY_COLORS } from '@/types/complaints'

export const ComplaintDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: complaint, isLoading, error } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getOne(id!),
    enabled: !!id,
    staleTime: 30000,
  })

  const replyMutation = useMutation({
    mutationFn: (text: string) => complaintsApi.reply(id!, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] })
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => complaintsApi.addInternalNote(id!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] })
    },
  })

  const handleReply = async (text: string) => {
    await replyMutation.mutateAsync(text)
  }

  const handleAddNote = async (content: string) => {
    await addNoteMutation.mutateAsync(content)
  }

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!complaint) return <ErrorState title="Complaint not found" />

  return (
    <div className="space-y-4 max-w-4xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/complaints')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{complaint.subject}</h1>
          <p className="text-gray-500 mt-1">Complaint #{String(complaint.id).slice(0, 8)}</p>
        </div>
        <Badge className={COMPLAINT_STATUS_COLORS[complaint.status as ComplaintStatus]}>
          {complaint.statusDisplay || complaint.status.replace('_', ' ')}
        </Badge>
        <Badge className={COMPLAINT_PRIORITY_COLORS[complaint.priority as ComplaintPriority]}>
          {complaint.priorityDisplay || complaint.priority}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Messages" subtitle={`${complaint.messages?.length || 0} messages`}>
            <MessageThread
              messages={(complaint.messages || []).map((m) => ({
                id: m.id,
                content: m.text,
                senderName: m.senderName,
                senderRole: m.senderType === 'platform' ? 'support' : 'user',
                createdAt: m.createdAt,
                attachments: m.attachments || [],
              }))}
              onReply={handleReply}
              replyPlaceholder="Write a reply..."
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details" subtitle="">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{complaint.complainantName}</p>
                  <p className="text-xs text-gray-500 capitalize">{complaint.complainantType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{complaint.respondentName}</p>
                  <p className="text-xs text-gray-500 capitalize">{complaint.respondentType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                <Badge variant="default">{complaint.categoryDisplay || complaint.category.replace('_', ' ')}</Badge>
              </div>
              {complaint.orderId && (
                <div>
                  <p className="text-xs text-gray-500">Order ID</p>
                  <p className="text-sm font-mono">{complaint.orderId}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm text-gray-900">{new Date(complaint.createdAt).toLocaleString()}</p>
              </div>
              {complaint.assignedTo && (
                <div>
                  <p className="text-xs text-gray-500">Assigned to</p>
                  <p className="text-sm text-gray-900">Staff ID: {complaint.assignedTo}</p>
                </div>
              )}
            </div>
          </Card>
          <InternalNotesPanel
            notes={(complaint.internalNotes || []).map((n) => ({
              id: n.id,
              content: n.content,
              authorName: n.authorName,
              createdAt: n.createdAt,
            }))}
            onAddNote={handleAddNote}
          />
        </div>
      </div>
    </div>
  )
}
