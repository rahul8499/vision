import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emergencyMonitoringApi } from '@/api/emergencyMonitoringApi'
import type { EmergencyCity } from '@/types/emergencyMonitoring'

interface CityState {
  cities: EmergencyCity[]
  selectedCityId: string
  loaded: boolean
  setSelectedCityId: (cityId: string) => void
  loadCities: () => Promise<void>
  reset: () => void
}

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      cities: [],
      selectedCityId: '',
      loaded: false,
      setSelectedCityId: (selectedCityId) => set({ selectedCityId }),
      loadCities: async () => {
        if (get().loaded) return
        const cities = await emergencyMonitoringApi.getCities()
        const selected = get().selectedCityId
        set({
          cities,
          loaded: true,
          selectedCityId: selected && cities.some((city) => String(city.id) === selected) ? selected : '',
        })
      },
      reset: () => set({ cities: [], selectedCityId: '', loaded: false }),
    }),
    {
      name: 'support-city-scope',
      partialize: (state) => ({ selectedCityId: state.selectedCityId }),
    },
  ),
)
