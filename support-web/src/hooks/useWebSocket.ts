import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

type MessageHandler = (data: unknown) => void

export const useWebSocket = (url: string) => {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<string, MessageHandler[]>>(new Map())
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        reconnectAttemptsRef.current = 0
        toast.success('Connected to live updates')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const { type, payload } = message
          const handlers = handlersRef.current.get(type) || []
          handlers.forEach((handler) => handler(payload))
        } catch {
          console.error('Failed to parse WebSocket message:', event.data)
        }
      }

      wsRef.current.onerror = () => {
        toast.error('WebSocket connection error')
      }

      wsRef.current.onclose = () => {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, reconnectDelay)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      toast.error('Failed to connect to live updates')
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const subscribe = useCallback((eventType: string, handler: MessageHandler) => {
    const handlers = handlersRef.current.get(eventType) || []
    handlers.push(handler)
    handlersRef.current.set(eventType, handlers)

    return () => {
      const currentHandlers = handlersRef.current.get(eventType) || []
      const filteredHandlers = currentHandlers.filter((h) => h !== handler)
      handlersRef.current.set(eventType, filteredHandlers)
    }
  }, [])

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    connect,
    disconnect,
    subscribe,
    send,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}
