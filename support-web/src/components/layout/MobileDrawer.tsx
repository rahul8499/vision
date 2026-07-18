import { X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { Sidebar } from './Sidebar'

export const MobileDrawer = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
        sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
      <div
        className={`relative bg-white w-72 h-full transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-end p-4">
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <Sidebar />
      </div>
    </div>
  )
}
