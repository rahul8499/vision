import apiClient from './axios'

export type CaseType = 'complaint' | 'ticket' | 'refund' | 'safety_report'
export type CaseManagementData = {
  escalations: Array<Record<string, any>>
  relations: Array<Record<string, any>>
  engineering_issues: Array<Record<string, any>>
  sensitive_actions: Array<Record<string, any>>
  deliveries: Array<Record<string, any>>
}

export const caseManagementApi = {
  search: async (query: string): Promise<Array<Record<string, any>>> => {
    const response = await apiClient.get('/case-management/search/', { params: { q: query } })
    return response.data.data?.results || []
  },
  get: async (type: CaseType, id: string | number): Promise<CaseManagementData> => {
    const response = await apiClient.get(`/cases/${type}/${id}/management/`)
    return response.data.data
  },
  act: async (type: CaseType, id: string | number, payload: Record<string, unknown>) => {
    const response = await apiClient.post(`/cases/${type}/${id}/management/`, payload)
    return response.data.data
  },
}
