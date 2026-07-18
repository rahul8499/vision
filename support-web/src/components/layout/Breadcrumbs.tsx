import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const routeNameMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/complaints': 'Complaints',
  '/complaints/': 'Complaint Detail',
  '/tickets': 'Support Tickets',
  '/tickets/': 'Ticket Detail',
  '/refunds': 'Refunds',
  '/refunds/': 'Refund Detail',
  '/safety-reports': 'Safety Reports',
  '/safety-reports/': 'Safety Report Detail',
  '/user-lookup': 'User Lookup',
  '/user-lookup/': 'User Profile',
  '/store-lookup': 'Store Lookup',
  '/store-lookup/': 'Store Profile',
  '/staff': 'Staff Management',
  '/staff/': 'Staff Detail',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
}

export const Breadcrumbs = () => {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/')
    const name = routeNameMap[path] || routeNameMap[path + '/'] || segment.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    const isLast = index === pathSegments.length - 1
    return { path, name, isLast }
  })

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <Link to="/dashboard" className="hover:text-gray-700 transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.path} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-900">{crumb.name}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-gray-700 transition-colors">
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
