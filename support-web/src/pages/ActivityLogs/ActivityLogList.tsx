import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loading } from '@/components/common/Loading'
import { ErrorState } from '@/components/common/ErrorState'
import { Activity, User, Calendar, Tag, ShieldAlert, CreditCard, Package, Upload, Bell, MessageSquare, Server } from 'lucide-react'
import apiClient from '@/api/axios'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

const CATEGORIES = [
  ['all', 'All activity'],
  ['prescription_log', 'Prescriptions'],
  ['quote_log', 'Quotes'],
  ['order_log', 'Orders'],
  ['support_log', 'Support'],
  ['security_log', 'Security'],
  ['ai_log', 'AI scans'],
  ['delivery_log', 'Delivery'],
  ['store_log', 'Stores'],
  ['production', 'Production'],
] as const

const CATEGORY_COLORS: Record<string, string> = {
  prescription_log: 'bg-blue-100 text-blue-800',
  quote_log: 'bg-emerald-100 text-emerald-800',
  order_log: 'bg-purple-100 text-purple-800',
  support_log: 'bg-amber-100 text-amber-800',
  security_log: 'bg-red-100 text-red-800',
  ai_log: 'bg-cyan-100 text-cyan-800',
  delivery_log: 'bg-orange-100 text-orange-800',
  store_log: 'bg-gray-100 text-gray-800',
  production_log: 'bg-rose-100 text-rose-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  prescription_log: 'Prescription activity',
  quote_log: 'Quotation activity',
  order_log: 'Order activity',
  support_log: 'Support activity',
  security_log: 'Security event',
  ai_log: 'AI scan event',
  delivery_log: 'Delivery activity',
  store_log: 'Store activity',
  production_log: 'Production event',
}

type SummaryTab = {
  key: string
  label: string
  description: string
  categories: string[]
  icon?: typeof Activity
}

const PRODUCTION_SECTIONS = [
  { title: 'Authentication', description: 'Login, token, and suspicious access events.', icon: ShieldAlert },
  { title: 'Payments', description: 'Razorpay order, verification, refund, and subscription events.', icon: CreditCard },
  { title: 'Orders', description: 'Order creation, status changes, and cancellations.', icon: Package },
  { title: 'Uploads', description: 'Prescription, document, and S3 upload failures.', icon: Upload },
  { title: 'Notifications', description: 'Expo notification sent/failed and invalid push tokens.', icon: Bell },
  { title: 'Complaints', description: 'Complaint creation, status changes, and admin resolution.', icon: MessageSquare },
  { title: 'System', description: 'Database errors, slow APIs, unhandled exceptions, and background jobs.', icon: Server },
] as const

const SUMMARY_TABS: SummaryTab[] = [
  {
    key: 'all',
    label: 'All activity',
    description: 'Everything recorded in the activity log.',
    categories: ['prescription_log', 'quote_log', 'order_log', 'support_log', 'security_log', 'ai_log', 'delivery_log', 'store_log', 'production_log'],
    icon: Activity,
  },
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    description: 'Prescription creation, responses, dispatch, and delivery events.',
    categories: ['prescription_log'],
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Order status changes and fulfillment flow.',
    categories: ['order_log', 'delivery_log'],
    icon: Package,
  },
  {
    key: 'support',
    label: 'Support',
    description: 'Support actions, complaints, refunds, and tickets.',
    categories: ['support_log'],
    icon: MessageSquare,
  },
  {
    key: 'production',
    label: 'Production',
    description: 'Security, slow APIs, upload failures, and system incidents.',
    categories: ['support_log', 'security_log', 'production_log'],
    icon: Server,
  },
]

const getCategoryGroup = (selected: string) => {
  const tab = SUMMARY_TABS.find((item) => item.key === selected)
  return tab?.categories ?? (selected === 'all' ? SUMMARY_TABS[0].categories : [selected])
}

export const ActivityLogList = () => {
  const [category, setCategory] = useState<string>('all')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const params: Record<string, string> = { page_size: '100' }
      const response = await apiClient.get('/activity-logs/', { params })
      return response.data
    },
    staleTime: 30000,
  })

  useEffect(() => { refetch() }, [refetch])

  if (isLoading) return <Loading />
  if (!data) return <ErrorState />

  const logs = data.data?.results ?? []
  const activeTab = SUMMARY_TABS.find((tab) => tab.key === category) || SUMMARY_TABS[0]
  const visibleLogs = logs.filter((log: { category?: string }) => getCategoryGroup(category).includes(log.category || ''))
  const tabCounts = Object.fromEntries(
    SUMMARY_TABS.map((tab) => [
      tab.key,
      logs.filter((log: { category?: string }) => tab.categories.includes(log.category || '')).length,
    ]),
  ) as Record<string, number>

  const formatActor = (log: { actor_type?: string; actor_id?: string }) => {
    if (!log.actor_type && !log.actor_id) return 'System'
    return `${log.actor_type || 'unknown'} #${log.actor_id || '-'}`
  }

  const formatSubject = (log: { subject_type?: string; subject_id?: string }) => {
    if (!log.subject_type && !log.subject_id) return null
    return `${log.subject_type || 'record'} #${log.subject_id || '-'}`
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production activity log</h1>
          <p className="text-gray-500 mt-1">Track production, support, and security events in one place for admin and supervisor review.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">{activeTab.label}</p>
          <p className="text-xs text-slate-500">{activeTab.description}</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
          {visibleLogs.length} visible events
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SUMMARY_TABS.map((tab) => {
          const isActive = category === tab.key
          const Icon = tab.icon || Activity
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
              className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{tab.label}</p>
                  <p className="text-xs text-slate-500">{tab.description}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-rose-600">{tabCounts[tab.key] || 0} events</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PRODUCTION_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              category === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
              {logs.filter((log: { category?: string }) => {
                if (key === 'all') return true
                if (key === 'production') return ['support_log', 'security_log', 'production_log'].includes(log.category || '')
                return log.category === key
              }).length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {visibleLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No activity has been recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {visibleLogs.map((log: unknown) => {
              const logData = log as {
                id: string | number
                category: string
                action: string
                actor_type?: string
                actor_id?: string
                subject_type?: string
                subject_id?: string
                title: string
                details?: Record<string, unknown>
                created_at?: string
              }
              const categoryColor = CATEGORY_COLORS[logData.category] || 'bg-gray-100 text-gray-800'
              const categoryLabel = CATEGORY_LABELS[logData.category] || logData.category
              const subject = formatSubject(logData)
              return (
                <div key={logData.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${categoryColor}`}>
                        {categoryLabel}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{logData.action}</span>
                      {subject && (
                        <span className="text-xs text-gray-500">on {subject}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{logData.title}</p>
                    {logData.details && Object.keys(logData.details).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(logData.details).slice(0, 4).map(([key, value]) => (
                          <span key={key} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-[10px] font-medium text-gray-600 border border-gray-200">
                            <Tag className="h-3 w-3 mr-1 text-gray-400" />
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {formatActor(logData)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(logData.created_at || '').toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
