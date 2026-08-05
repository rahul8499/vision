import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import toast from 'react-hot-toast'
import type { AuthResponse, RefreshTokenRequest, User } from '@/types/auth'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/lib/logger'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/support-api/v1'
const SLOW_REQUEST_MS = Number(import.meta.env.VITE_SLOW_REQUEST_MS || 3000)

type MonitoredRequestConfig = InternalAxiosRequestConfig & {
  metadata?: {
    startedAt: number
  }
  _retry?: boolean
  _networkRetry?: number
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.request.use(
  (config: MonitoredRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.metadata = { startedAt: performance.now() }
    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as MonitoredRequestConfig
    const durationMs = config.metadata ? Math.round(performance.now() - config.metadata.startedAt) : 0

    if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn('support-api:slow-request', {
        url: config.url,
        method: config.method,
        status: response.status,
        durationMs,
      })
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config as MonitoredRequestConfig
    const durationMs = originalRequest?.metadata ? Math.round(performance.now() - originalRequest.metadata.startedAt) : undefined

    if (originalRequest?.method?.toLowerCase() === 'get' && (!error.response || error.response.status >= 500) && !originalRequest._networkRetry) {
      originalRequest._networkRetry = 1
      return apiClient(originalRequest)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      logger.warn('support-api:unauthorized', {
        url: originalRequest.url,
        method: originalRequest.method,
        durationMs,
      })

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              resolve(apiClient(originalRequest))
            },
            reject: (err: Error) => reject(err),
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const response = await axios.post<{ success: boolean; data: { access: string; refresh: string } }>(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        } as RefreshTokenRequest)

        const refreshData = response.data.data
        const accessToken = refreshData.access
        const newRefreshToken = refreshData.refresh
        const user = useAuthStore.getState().user
        if (!user) {
          throw new Error('No authenticated support user')
        }
        useAuthStore.getState().setTokens(accessToken, newRefreshToken, user)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }

        processQueue(null, accessToken)
        return apiClient(originalRequest)
      } catch (refreshError) {
        logger.error('support-api:refresh-failed', {
          url: originalRequest.url,
          method: originalRequest.method,
          durationMs,
          error: logger.errorPayload(refreshError),
        })
        processQueue(refreshError as Error, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status >= 500) {
      logger.error('support-api:server-error', {
        url: originalRequest.url,
        method: originalRequest.method,
        status: error.response.status,
        durationMs,
      })
      toast.error('Something went wrong. Please try again later.')
    } else if (error.response?.data?.message) {
      logger.warn('support-api:request-failed', {
        url: originalRequest.url,
        method: originalRequest.method,
        status: error.response?.status,
        durationMs,
        message: error.response.data.message,
      })
      toast.error(error.response.data.message)
    }

    return Promise.reject(error)
  }
)

export default apiClient
