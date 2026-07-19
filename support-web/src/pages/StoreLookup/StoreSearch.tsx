import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lookupApi } from '@/api/lookupApi'
import { useDebounce } from '@/hooks/useDebounce'
import { Input } from '@/components/common/Input'
import { Card } from '@/components/common/Card'
import { Loading } from '@/components/common/Loading'
import { Search, Store as StoreIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const StoreSearch = () => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['store-search', debouncedQuery],
    queryFn: () => lookupApi.searchStores(debouncedQuery, 20),
    enabled: debouncedQuery.length > 2,
    staleTime: 60000,
  })

  const stores = storesData?.results ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Find a Store</h1>
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores by name, email, or phone..."
              className="pl-10"
            />
          </div>
        </div>
      </Card>
      {isLoading && <Loading />}
      {!isLoading && stores.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/store-lookup/${store.id}`)}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <StoreIcon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{store.name}</h3>
                  <p className="text-sm text-gray-500">{store.ownerName}</p>
                  <p className="text-sm text-gray-500">{store.email}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>{store.isActive ? 'Active' : 'Inactive'}</span>
                    <span>{store.isVerified ? 'Verified' : 'Unverified'}</span>
                    <span>Rating: {store.averageRating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && debouncedQuery.length > 2 && stores.length === 0 && (
        <Card>
          <p className="text-center text-gray-500 py-8">No stores found matching "{debouncedQuery}"</p>
        </Card>
      )}
    </div>
  )
}
