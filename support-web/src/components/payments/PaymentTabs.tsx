import { NavLink } from 'react-router-dom'
import { CreditCard, RotateCcw } from 'lucide-react'

const tabs = [
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/refunds', label: 'Refunds', icon: RotateCcw },
]

export const PaymentTabs = () => (
  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
    {tabs.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </NavLink>
    ))}
  </div>
)
