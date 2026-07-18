import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export const SearchInput = ({ value, onChange, placeholder = 'Search...', debounceMs = 300, className = '' }: SearchInputProps) => {
  const debouncedValue = useDebounce(value, debounceMs)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-full"
      />
    </div>
  )
}
