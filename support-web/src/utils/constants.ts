import { QueryClient } from '@tanstack/react-query'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/support-api/v1'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AARX Support Web'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
})

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  limits: [10, 20, 50, 100],
} as const

export const SORT_DEFAULTS = {
  sortBy: 'createdAt',
  sortOrder: 'desc' as const,
} as const
