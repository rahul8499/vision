import apiClient from './axios'
import type { DashboardStats } from '@/types/dashboard'

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/summary/')
    return response.data.data
  },

  getAgentPerformance: async (): Promise<unknown> => {
    const response = await apiClient.get('/dashboard/agent-workload/')
    return response.data.data
  },

  getTrends: async (params: { period?: string; type?: string }): Promise<unknown> => {
    const response = await apiClient.get('/dashboard/trends/', { params })
    return response.data.data
  },
}
