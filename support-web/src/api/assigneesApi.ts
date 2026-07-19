import apiClient from './axios'

export interface Assignee {
  id: string
  name: string
  role: 'agent' | 'supervisor' | 'admin'
}

export const assigneesApi = {
  getAll: async (scope: 'CITY' | 'GLOBAL', city?: number | string, cities?: number[]): Promise<Assignee[]> => {
    const response = await apiClient.get('/assignees/', {
      params: { scope, city, cities: cities?.length ? cities.join(',') : undefined },
    })
    return response.data.data || []
  },
}
