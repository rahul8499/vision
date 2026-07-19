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
  Headphones,
} from 'lucide-react'
import type { UserRole } from '@/types/auth'

type MenuKey = 'dashboard' | 'operations' | 'emergency' | 'complaints' | 'tickets' | 'payments' | 'refunds' | 'safety' | 'users' | 'stores' | 'staff' | 'audit'
type MenuItem = { to: string; label: string; description: string; icon: React.ReactNode }

const MENU_ITEMS: Record<MenuKey, MenuItem> = {
  dashboard: { to: '/dashboard', label: "Today's work summary", description: 'See open work, urgent cases, and team progress.', icon: <LayoutDashboard className="h-5 w-5" /> },
  operations: { to: '/operations', label: 'My tasks and tools', description: 'Work assigned cases, follow-ups, ready replies, and reports.', icon: <Headphones className="h-5 w-5" /> },
  emergency: { to: '/emergency-monitoring', label: 'Urgent medicine requests', description: 'Help when nearby stores have not responded in time.', icon: <Radio className="h-5 w-5" /> },
  complaints: { to: '/complaints', label: 'Customer complaints', description: 'Investigate complaints, reply, assign, and resolve them.', icon: <MessageSquare className="h-5 w-5" /> },
  tickets: { to: '/tickets', label: 'App help requests', description: 'Answer account, app, verification, and technical questions.', icon: <Ticket className="h-5 w-5" /> },
  payments: { to: '/payments', label: 'Payment records', description: 'Find charges and check whether a payment succeeded or failed.', icon: <CreditCard className="h-5 w-5" /> },
  refunds: { to: '/refunds', label: 'Refund requests', description: 'Review, approve, reject, or complete customer refunds.', icon: <Wallet className="h-5 w-5" /> },
  safety: { to: '/safety-reports', label: 'Medicine safety issues', description: 'Handle unsafe medicine, fraud, and serious safety reports.', icon: <ShieldAlert className="h-5 w-5" /> },
  users: { to: '/user-lookup', label: 'Find a customer', description: 'Open a customer profile and see their complete support history.', icon: <UserSearch className="h-5 w-5" /> },
  stores: { to: '/store-lookup', label: 'Find a pharmacy', description: 'Check pharmacy details, orders, complaints, and performance.', icon: <Store className="h-5 w-5" /> },
  staff: { to: '/staff', label: 'Manage support staff', description: 'Create staff accounts and control their access.', icon: <Users className="h-5 w-5" /> },
  audit: { to: '/audit-logs', label: 'Who changed what', description: 'See which staff member performed each important action.', icon: <ClipboardList className="h-5 w-5" /> },
}

const menu = (...keys: MenuKey[]) => keys.map(key => MENU_ITEMS[key])
const ROLE_MENU_ITEMS: Record<UserRole, MenuItem[]> = {
  admin: menu('dashboard', 'operations', 'emergency', 'complaints', 'tickets', 'payments', 'refunds', 'safety', 'users', 'stores', 'staff', 'audit'),
  supervisor: menu('dashboard', 'operations', 'emergency', 'complaints', 'tickets', 'payments', 'refunds', 'safety', 'users', 'stores'),
  agent: menu('dashboard', 'operations', 'emergency', 'complaints', 'tickets', 'payments', 'refunds', 'safety'),
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
                      'group relative flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    ].join(' ')
                  }
                >
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[11px] font-normal leading-4 opacity-70">{item.description}</span></span>
                  <span role="tooltip" className="pointer-events-none absolute left-2 top-full z-[90] mt-2 hidden w-56 rounded-xl border border-white/10 bg-slate-950/95 px-3.5 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-[0_14px_38px_rgba(15,23,42,0.28)] backdrop-blur-md group-hover:block group-focus-visible:block">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-300">What you can do here</span>
                    <span className="mt-0.5 block">{item.description}</span>
                    <span className="absolute bottom-full left-6 h-2 w-2 translate-y-1/2 rotate-45 border-l border-t border-white/10 bg-slate-950" />
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <NavLink
            to="/settings"
            className="group relative flex items-start gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Settings className="mt-0.5 h-5 w-5 shrink-0" />
            <span><span className="block text-sm font-semibold">My account</span><span className="mt-0.5 block text-[11px] leading-4 opacity-70">Change your profile, password, and personal settings.</span></span>
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-2 z-[90] mb-2 hidden w-56 rounded-xl border border-white/10 bg-slate-950/95 px-3.5 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-[0_14px_38px_rgba(15,23,42,0.28)] backdrop-blur-md group-hover:block group-focus-visible:block"><span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-300">What you can do here</span><span className="mt-0.5 block">Change your profile, password, and personal settings.</span></span>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
