import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendChartProps {
  data: { date: string; value: number }[]
  color?: string
  height?: number
  title?: string
}

export const TrendChart = ({ data, color = '#3b82f6', height = 300, title }: TrendChartProps) => {
  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-700 mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              try {
                return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              } catch {
                return value
              }
            }}
          />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
