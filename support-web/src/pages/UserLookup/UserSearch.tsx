import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lookupApi } from '@/api/lookupApi'
import { useDebounce } from '@/hooks/useDebounce'
import { Input } from '@/components/common/Input'
import { Card } from '@/components/common/Card'
import { Loading } from '@/components/common/Loading'
import { Search, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const UserSearch = () => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: () => lookupApi.searchUsers(debouncedQuery, 20),
    enabled: debouncedQuery.length > 2,
    staleTime: 60000,
  })

  const users = usersData?.results ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Find a User</h1>
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by name, email, or phone..."
              className="pl-10"
            />
          </div>
        </div>
      </Card>
      {isLoading && <Loading />}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/user-lookup/${user.id}`)}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="text-sm text-gray-500">{user.mobile}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>{user.isActive ? 'Active' : 'Inactive'}</span>
                    <span>{user.isVerified ? 'Verified' : 'Unverified'}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && debouncedQuery.length > 2 && users.length === 0 && (
        <Card>
          <p className="text-center text-gray-500 py-8">No users found matching "{debouncedQuery}"</p>
        </Card>
      )}
    </div>
  )
}
