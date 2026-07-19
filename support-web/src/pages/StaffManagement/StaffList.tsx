import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffApi } from '@/api/staffApi'
import { DataTable } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { SelectFilter } from '@/components/filters/SelectFilter'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Loading } from '@/components/common/Loading'
import { useNavigate } from 'react-router-dom'
import { Users, UserPlus } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_LABELS } from '@/types/auth'
import type { StaffMember, StaffStatus } from '@/types/staff'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'agent', label: 'Agent' },
]

export const StaffList = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['staff', page, debouncedSearch, status, role],
    queryFn: () => staffApi.getAll({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status as StaffStatus) || undefined,
      role: role || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    staleTime: 30000,
  })

  const staff = data?.results ?? []
  const pagination = data?.pagination

  const columns = [
    { key: 'email', header: 'Email', render: (item: StaffMember) => item.email },
    { key: 'name', header: 'Name', render: (item: StaffMember) => item.name },
    { key: 'role', header: 'Access level', render: (item: StaffMember) => (
      <Badge variant="default">{ROLE_LABELS[item.role] || item.role}</Badge>
    )},
    { key: 'status', header: 'Status', render: (item: StaffMember) => (
      <Badge variant={item.status === 'active' ? 'success' : item.status === 'suspended' ? 'danger' : 'default'}>
        {item.status}
      </Badge>
    )},
    { key: 'department', header: 'Department', render: (item: StaffMember) => item.department || '-' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Team</h1>
          <p className="text-gray-500 mt-1">Add support-team members and control which cities and actions they can access.</p>
        </div>
        <Button onClick={() => navigate('/staff/new')} leftIcon={<UserPlus className="h-4 w-4" />}>
          Add Staff
        </Button>
      </div>

      <FilterBar onReset={() => { setSearch(''); setStatus(''); setRole(''); setPage(1); }} activeFiltersCount={[status, role, search].filter(Boolean).length}>
        <SearchInput value={search} onChange={setSearch} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectFilter label="Access level" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      </FilterBar>

      {isLoading ? (
        <Loading />
      ) : staff.length === 0 ? (
        <EmptyState icon={<Users className="h-12 w-12" />} title="No staff found" description="No staff members match your filters." />
      ) : (
        <>
          <DataTable data={staff} columns={columns} keyExtractor={(item) => item.id} onRowClick={(item) => navigate(`/staff/${item.id}`)} />
          <div className="bg-white rounded-xl border border-gray-200">
            <Pagination currentPage={page} totalPages={pagination?.total_pages ?? 1} totalItems={pagination?.total_count ?? 0} itemsPerPage={20} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
