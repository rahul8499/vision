import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface BarChartProps {
  data: { name: string; value: number }[]
  color?: string
  height?: number
  title?: string
  layout?: 'vertical' | 'horizontal'
}

export const SimpleBarChart = ({ data, color = '#3b82f6', height = 300, title, layout = 'horizontal' }: BarChartProps) => {
  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-700 mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : undefined}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {layout === 'horizontal' ? (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} width={100} />
            </>
          )}
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
