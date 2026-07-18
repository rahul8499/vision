import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '@/api/ticketsApi'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageThread } from '@/components/threads/MessageThread'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Ticket } from '@/types/tickets'
import { TICKET_STATUS_COLORS, TICKET_PRIORITY_COLORS } from '@/types/tickets'

export const TicketDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsApi.getOne(id!),
    enabled: !!id,
    staleTime: 30000,
  })

  const replyMutation = useMutation({
    mutationFn: (text: string) => ticketsApi.reply(id!, { text }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const handleReply = async (text: string) => {
    await replyMutation.mutateAsync(text)
    toast.success('Reply sent')
  }

  if (isLoading) return <Loading />
  if (error) return <ErrorState />
  if (!ticket) return <ErrorState title="Ticket not found" />

  return (
    <div className="space-y-4 max-w-4xl">
      <Breadcrumbs />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/tickets')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-gray-500 mt-1">Ticket #{String(ticket.id).slice(0, 8)}</p>
        </div>
        <Badge variant={TICKET_STATUS_COLORS[ticket.status] || 'default'}>{ticket.statusDisplay || ticket.status.replace('_', ' ')}</Badge>
        <Badge variant={TICKET_PRIORITY_COLORS[ticket.priority] || 'default'}>{ticket.priorityDisplay || ticket.priority}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Messages">
            <MessageThread
              messages={ticket.messages.map((m) => ({
                id: m.id,
                content: m.text,
                senderName: m.senderName,
                senderRole: m.senderType === 'platform' ? 'support' : 'user',
                createdAt: m.createdAt,
                isInternal: m.senderType === 'platform',
                attachments: m.attachment ? [m.attachment] : [],
              }))}
              onReply={handleReply}
            />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Details">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <Badge variant="default">{ticket.categoryDisplay || ticket.category.replace('_', ' ')}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Priority</p>
                <Badge variant={TICKET_PRIORITY_COLORS[ticket.priority] || 'default'}>{ticket.priorityDisplay || ticket.priority}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={TICKET_STATUS_COLORS[ticket.status] || 'default'}>{ticket.statusDisplay || ticket.status.replace('_', ' ')}</Badge>
              </div>
              {ticket.assignedTo && (
                <div>
                  <p className="text-xs text-gray-500">Assigned to</p>
                  <p className="text-sm">Staff ID: {ticket.assignedTo}</p>
                </div>
              )}
              {ticket.resolutionNote && (
                <div>
                  <p className="text-xs text-gray-500">Resolution Note</p>
                  <p className="text-sm">{ticket.resolutionNote}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
