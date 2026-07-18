import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'

export const useSupportWebSocket = () => {
  const accessToken = useAuthStore.getState().accessToken
  const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'
  const wsUrl = `${WS_BASE_URL}/support?token=${accessToken || ''}`

  return useWebSocket(wsUrl)
}
