import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/$/, '')

export const supportWebSocket = () => {
  const accessToken = useAuthStore.getState().accessToken
  const wsUrl = `${WS_BASE_URL}/ws/support/?token=${encodeURIComponent(accessToken || '')}`

  const { connect, disconnect, subscribe, send, isConnected } = useWebSocket(wsUrl)

  const notificationHandler = (payload: unknown) => {
    const notification = payload as { title: string; message: string }
    toast(notification.message, {
      icon: '🔔',
      duration: 5000,
    })
  }

  const ticketUpdateHandler = (payload: unknown) => {
    console.log('Ticket update:', payload)
  }

  const complaintUpdateHandler = (payload: unknown) => {
    console.log('Complaint update:', payload)
  }

  connect()

  const unsubNotification = subscribe('notification', notificationHandler)
  const unsubTicket = subscribe('ticket_update', ticketUpdateHandler)
  const unsubComplaint = subscribe('complaint_updated', complaintUpdateHandler)

  return {
    disconnect,
    subscribe,
    send,
    isConnected,
    unsubscribe: () => {
      unsubNotification()
      unsubTicket()
      unsubComplaint()
    },
  }
}
