import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  theme: Theme
  setTheme: (theme: Theme) => void
  selectedComplaintId: string | null
  setSelectedComplaintId: (id: string | null) => void
  selectedTicketId: string | null
  setSelectedTicketId: (id: string | null) => void
  notificationPanelOpen: boolean
  setNotificationPanelOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      selectedComplaintId: null,
      setSelectedComplaintId: (id) => set({ selectedComplaintId: id }),
      selectedTicketId: null,
      setSelectedTicketId: (id) => set({ selectedTicketId: id }),
      notificationPanelOpen: false,
      setNotificationPanelOpen: (open) => set({ notificationPanelOpen: open }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
