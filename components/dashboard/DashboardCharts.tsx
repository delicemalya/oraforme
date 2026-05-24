'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

interface DonutEntry { name: string; value: number; color: string }
interface BarEntry  { day: string; factures: number }

interface Props {
  donutData: DonutEntry[]
  barData: BarEntry[]
  donutTitle: string
}

export default function DashboardCharts({ donutData, barData, donutTitle }: Props) {
  const totalDonut = donutData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Donut chart */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">{donutTitle}</h3>
        {donutData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1C2128',
                    border: '1px solid #30363D',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#FFFFFF',
                  }}
                  formatter={(val, name) => [
                    `${val} (${Math.round((Number(val) / totalDonut) * 100)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-[var(--text-secondary)]">{d.name}</span>
                  <span className="text-[11px] font-semibold" style={{ color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-[190px] flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--border)] border-dashed" />
            <p className="text-xs text-[var(--text-secondary)]">Aucune donnée</p>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Activité — 7 derniers jours</h3>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={barData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2d50" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1C2128',
                border: '1px solid #30363D',
                borderRadius: 8,
                fontSize: 12,
                color: '#FFFFFF',
              }}
              cursor={{ fill: '#1a2d50', radius: 4 }}
              formatter={(val) => [val, 'Factures']}
            />
            <Bar dataKey="factures" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
