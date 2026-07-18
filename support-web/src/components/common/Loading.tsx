import type { ReactNode } from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export const Loading = ({ size = 'md', className = '' }: LoadingProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg className={`animate-spin text-primary-600 ${sizeClasses[size]}`} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

interface FullPageLoadingProps {
  message?: string
}

export const FullPageLoading = ({ message = 'Loading...' }: FullPageLoadingProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loading size="lg" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  )
}

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className = '' }: SkeletonProps) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  )
}

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
