import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/components/permissions/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { Loading } from '@/components/common/Loading'
import { LoginPage } from '@/pages/Login/LoginPage'

const LazyWrapper = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<Loading size="lg" className="min-h-[400px]" />}>
    <Component />
  </Suspense>
)

const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const EmergencyMonitoringPage = lazy(() => import('@/pages/EmergencyMonitoring/EmergencyMonitoringPage').then(m => ({ default: m.EmergencyMonitoringPage })))
const ComplaintList = lazy(() => import('@/pages/Complaints/ComplaintList').then(m => ({ default: m.ComplaintList })))
const ComplaintDetail = lazy(() => import('@/pages/Complaints/ComplaintDetail').then(m => ({ default: m.ComplaintDetail })))
const TicketList = lazy(() => import('@/pages/SupportTickets/TicketList').then(m => ({ default: m.TicketList })))
const TicketDetail = lazy(() => import('@/pages/SupportTickets/TicketDetail').then(m => ({ default: m.TicketDetail })))
const PaymentList = lazy(() => import('@/pages/Payments/PaymentList').then(m => ({ default: m.PaymentList })))
const RefundList = lazy(() => import('@/pages/Refunds/RefundList').then(m => ({ default: m.RefundList })))
const RefundDetail = lazy(() => import('@/pages/Refunds/RefundDetail').then(m => ({ default: m.RefundDetail })))
const SafetyReportList = lazy(() => import('@/pages/SafetyReports/SafetyReportList').then(m => ({ default: m.SafetyReportList })))
const SafetyReportDetail = lazy(() => import('@/pages/SafetyReports/SafetyReportDetail').then(m => ({ default: m.SafetyReportDetail })))
const UserSearch = lazy(() => import('@/pages/UserLookup/UserSearch').then(m => ({ default: m.UserSearch })))
const UserProfile = lazy(() => import('@/pages/UserLookup/UserProfile').then(m => ({ default: m.UserProfile })))
const StoreSearch = lazy(() => import('@/pages/StoreLookup/StoreSearch').then(m => ({ default: m.StoreSearch })))
const StoreProfile = lazy(() => import('@/pages/StoreLookup/StoreProfile').then(m => ({ default: m.StoreProfile })))
const StaffList = lazy(() => import('@/pages/StaffManagement/StaffList').then(m => ({ default: m.StaffList })))
const StaffDetail = lazy(() => import('@/pages/StaffManagement/StaffDetail').then(m => ({ default: m.StaffDetail })))
const AuditLogList = lazy(() => import('@/pages/AuditLogs/AuditLogList').then(m => ({ default: m.AuditLogList })))
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage').then(m => ({ default: m.SettingsPage })))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: '', element: LazyWrapper(DashboardPage) },
      { path: 'dashboard', element: LazyWrapper(DashboardPage) },
      { path: 'emergency-monitoring', element: LazyWrapper(EmergencyMonitoringPage) },
      { path: 'complaints', element: LazyWrapper(ComplaintList) },
      { path: 'complaints/:id', element: LazyWrapper(ComplaintDetail) },
      { path: 'tickets', element: LazyWrapper(TicketList) },
      { path: 'tickets/:id', element: LazyWrapper(TicketDetail) },
      { path: 'payments', element: LazyWrapper(PaymentList) },
      { path: 'refunds', element: LazyWrapper(RefundList) },
      { path: 'refunds/:id', element: LazyWrapper(RefundDetail) },
      { path: 'safety-reports', element: LazyWrapper(SafetyReportList) },
      { path: 'safety-reports/:id', element: LazyWrapper(SafetyReportDetail) },
      { path: 'user-lookup', element: LazyWrapper(UserSearch) },
      { path: 'user-lookup/:id', element: LazyWrapper(UserProfile) },
      { path: 'store-lookup', element: LazyWrapper(StoreSearch) },
      { path: 'store-lookup/:id', element: LazyWrapper(StoreProfile) },
      { path: 'staff', element: LazyWrapper(StaffList) },
      { path: 'staff/:id', element: LazyWrapper(StaffDetail) },
      { path: 'audit-logs', element: LazyWrapper(AuditLogList) },
      { path: 'settings', element: LazyWrapper(SettingsPage) },
    ],
  },
])
