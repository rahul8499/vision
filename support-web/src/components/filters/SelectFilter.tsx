import type { ReactNode } from 'react'

interface SelectFilterProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

export const SelectFilter = ({ label, value, onChange, options, placeholder = 'Select', className = '' }: SelectFilterProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white min-w-[140px]"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
