import { NavLink } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useCurrentUser } from '@/store/authStore'
import {
  LayoutDashboard,
  MessageSquare,
  Ticket,
  CreditCard,
  Wallet,
  ShieldAlert,
  Users,
  UserSearch,
  Store,
  Settings,
  ClipboardList,
  Shield,
  Radio,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import type { UserRole } from '@/types/auth'

const ROLE_MENU_ITEMS: Record<UserRole, { to: string; label: string; icon: React.ReactNode }[]> = {
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { to: '/emergency-monitoring', label: 'Emergency Monitoring', icon: <Radio className="h-5 w-5" /> },
    { to: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-5 w-5" /> },
    { to: '/tickets', label: 'Support Tickets', icon: <Ticket className="h-5 w-5" /> },
    { to: '/payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" /> },
    { to: '/refunds', label: 'Refunds', icon: <Wallet className="h-5 w-5" /> },
    { to: '/safety-reports', label: 'Safety Reports', icon: <ShieldAlert className="h-5 w-5" /> },
    { to: '/user-lookup', label: 'User Lookup', icon: <UserSearch className="h-5 w-5" /> },
    { to: '/store-lookup', label: 'Store Lookup', icon: <Store className="h-5 w-5" /> },
    { to: '/staff', label: 'Staff Management', icon: <Users className="h-5 w-5" /> },
    { to: '/audit-logs', label: 'Audit Logs', icon: <ClipboardList className="h-5 w-5" /> },
  ],
  supervisor: [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { to: '/emergency-monitoring', label: 'Emergency Monitoring', icon: <Radio className="h-5 w-5" /> },
    { to: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-5 w-5" /> },
    { to: '/tickets', label: 'Support Tickets', icon: <Ticket className="h-5 w-5" /> },
    { to: '/payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" /> },
    { to: '/refunds', label: 'Refunds', icon: <Wallet className="h-5 w-5" /> },
    { to: '/safety-reports', label: 'Safety Reports', icon: <ShieldAlert className="h-5 w-5" /> },
    { to: '/user-lookup', label: 'User Lookup', icon: <UserSearch className="h-5 w-5" /> },
    { to: '/store-lookup', label: 'Store Lookup', icon: <Store className="h-5 w-5" /> },
  ],
  agent: [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { to: '/emergency-monitoring', label: 'Emergency Monitoring', icon: <Radio className="h-5 w-5" /> },
    { to: '/complaints', label: 'Complaints', icon: <MessageSquare className="h-5 w-5" /> },
    { to: '/tickets', label: 'Support Tickets', icon: <Ticket className="h-5 w-5" /> },
    { to: '/payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" /> },
    { to: '/refunds', label: 'Refunds', icon: <Wallet className="h-5 w-5" /> },
    { to: '/safety-reports', label: 'Safety Reports', icon: <ShieldAlert className="h-5 w-5" /> },
  ],
}

export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const user = useCurrentUser()

  const menuItems = user?.role ? ROLE_MENU_ITEMS[user.role] || [] : []

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed top-0 left-0 z-50 h-screen transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto bg-white border-r border-gray-200 w-64 flex flex-col`}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">AARX Support</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    ].join(' ')
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  )
}
