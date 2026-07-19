import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { ClipboardList, User, Calendar } from 'lucide-react'
import apiClient from '@/api/axios'

const ACTION_TYPES = ['create', 'update', 'delete', 'login', 'logout', 'assign', 'status_change', 'note_add']

export const AuditLogList = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await apiClient.get('/audit-logs/', { params: { page_size: 50 } })
      return response.data
    },
    staleTime: 30000,
  })

  if (isLoading) return <Loading />
  if (!data) return <ErrorState />

  const logs = data.data?.results ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity History</h1>
          <p className="text-gray-500 mt-1">See who changed, assigned or closed each support case and when it happened.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No staff activity has been recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log: unknown) => {
              const logData = log as {
                id: string
                action: string
                actor_name?: string
                actorName?: string
                entity_type?: string
                targetType?: string
                entity_id?: string
                targetId?: string
                created_at?: string
                createdAt?: string
                details?: string
              }
              return (
                <div key={logData.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{logData.actor_name || logData.actorName || 'System'}</span>
                      {' '}performed{' '}
                      <span className="font-medium">{logData.action}</span>
                      {' '}on{' '}
                      <span className="font-medium">{(logData.entity_type || logData.targetType || 'record').replace(/_/g, ' ')}</span>
                      {' '}{logData.entity_id || logData.targetId}
                    </p>
                    {logData.details && (
                      <p className="text-xs text-gray-500 mt-0.5">{logData.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(logData.created_at || logData.createdAt || '').toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
