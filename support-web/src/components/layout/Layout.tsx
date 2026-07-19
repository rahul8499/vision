import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { useUIStore } from '@/store/uiStore'
import { NotificationPanel } from './NotificationPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { showSupportBrowserNotification } from '@/utils/browserNotifications'

const routeForNotification = (entityType?: string, entityId?: string | number) => {
  if (entityId == null) return undefined
  if (entityType === 'complaint') return `/complaints/${entityId}`
  if (entityType === 'ticket' || entityType === 'platformsupportticket') return `/tickets/${entityId}`
  if (entityType === 'refund' || entityType === 'refundrequest') return `/refunds/${entityId}`
  if (entityType === 'safety_report' || entityType === 'safetyreport') return `/safety-reports/${entityId}`
  return undefined
}

const tokenExpiresAt = (token: string) => {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return payload.exp ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

export const Layout = () => {
  const { sidebarOpen } = useUIStore()
  const token = useAuthStore(s => s.accessToken)
  const refreshTokens = useAuthStore(s => s.refreshTokens)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const wsBase = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/$/, '')
  const { subscribe } = useWebSocket(`${wsBase}/ws/support/?token=${encodeURIComponent(token || '')}`)
  useEffect(() => {
    if (!token) return
    const expiresAt = tokenExpiresAt(token)
    if (!expiresAt) return
    const refreshIn = Math.max(0, expiresAt - Date.now() - 60_000)
    const timer = window.setTimeout(() => { void refreshTokens().catch(() => undefined) }, refreshIn)
    return () => window.clearTimeout(timer)
  }, [refreshTokens, token])

  useEffect(() => {
    const handler = (eventType: string) => (payload: unknown) => {
      const data = payload as { id?: string | number; message?: string }
      toast(data?.message || 'New support update', { icon: '🔔' })
      window.dispatchEvent(new CustomEvent('support-notification-refresh'))

      if (eventType === 'new_complaint' || eventType === 'complaint_updated') {
        queryClient.invalidateQueries({ queryKey: ['complaints'] })
        if (data.id != null) queryClient.invalidateQueries({ queryKey: ['complaint', String(data.id)] })
      }
      if (eventType === 'new_ticket' || eventType === 'ticket_updated') {
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
        if (data.id != null) queryClient.invalidateQueries({ queryKey: ['ticket', String(data.id)] })
      }
      if (eventType === 'new_refund') queryClient.invalidateQueries({ queryKey: ['refunds'] })
      if (eventType === 'sla_alert') queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      if (eventType === 'notification') {
        const notification = payload as {
          title?: string; message?: string; entity_type?: string; entity_id?: string | number
        }
        const route = routeForNotification(notification.entity_type, notification.entity_id)
        showSupportBrowserNotification(
          notification.title || 'AARX Support',
          notification.message || 'New support update',
          route ? () => navigate(route) : undefined,
        )
        queryClient.invalidateQueries({ queryKey: ['notifications-panel'] })
        if (notification.entity_type === 'complaint') queryClient.invalidateQueries({ queryKey: ['complaints'] })
        if (notification.entity_type === 'ticket') queryClient.invalidateQueries({ queryKey: ['tickets'] })
        if (notification.entity_type === 'refund') queryClient.invalidateQueries({ queryKey: ['refunds'] })
        if (notification.entity_type === 'safety_report') queryClient.invalidateQueries({ queryKey: ['safety-reports'] })
      }
    }
    const events = ['notification', 'new_complaint', 'new_ticket', 'new_refund', 'complaint_updated', 'ticket_updated', 'sla_alert']
    const unsub = events.map(event => subscribe(event, handler(event)))
    return () => unsub.forEach(fn => fn())
  }, [navigate, queryClient, subscribe])

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <NotificationPanel />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
