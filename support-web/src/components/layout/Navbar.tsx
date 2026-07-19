import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { Bell, Search, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { notificationsApi } from '@/api/notificationsApi'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useCityStore } from '@/store/cityStore'
import { enableSupportBrowserNotifications } from '@/utils/browserNotifications'

export const Navbar = () => {
  const { logout } = useAuth()
  const { sidebarOpen, setSidebarOpen, setNotificationPanelOpen, notificationPanelOpen } = useUIStore()
  const user = useAuthStore((state) => state.user)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { cities, selectedCityId, setSelectedCityId, loadCities } = useCityStore()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCities().catch(() => undefined)
  }, [loadCities])

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await notificationsApi.getUnreadCount()
        setUnreadCount(count)
      } catch {
        // ignore
      }
    }
    fetchUnreadCount()
    window.addEventListener('support-notification-refresh', fetchUnreadCount)
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => { clearInterval(interval); window.removeEventListener('support-notification-refresh', fetchUnreadCount) }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
      toast.success('Logged out successfully')
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
        >
          <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden lg:flex items-center relative">
          <Search className="absolute left-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <select
          aria-label="Choose the city you are working in"
          value={selectedCityId}
          onChange={(event) => setSelectedCityId(event.target.value)}
          className="hidden h-9 max-w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 sm:block"
        >
          <option value="">All cities I can access</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
        <button
          onClick={() => {
            const willOpen = !notificationPanelOpen
            setNotificationPanelOpen(willOpen)
            if (willOpen) {
              setUnreadCount(0)
              void enableSupportBrowserNotifications()
            }
          }}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="h-4 w-4 text-primary-600" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900">
                {user?.name}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden md:block" />
          </button>
          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowUserDropdown(false)
                  navigate('/settings')
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
