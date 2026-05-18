'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface Entry { name: string; value: number; color: string }

export default function ModuleChart({ data, title }: { data: Entry[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
        <p className="text-[10px] text-[#6B7280] mt-0.5">Répartition par statut</p>
      </div>

      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={66}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive
                animationBegin={200}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1C2128',
                  border: '1px solid #30363D',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 4px 16px #00000040',
                }}
                formatter={(val) => [
                  `${val} (${Math.round((Number(val) / total) * 100)}%)`,
                  '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-1.5 mt-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] text-[#4B5563] flex-1">{d.name}</span>
                <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[150px] flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 rounded-full border-4 border-dashed border-[#EEF2FF]" />
          <p className="text-xs text-[#6B7280]">Aucune donnée</p>
        </div>
      )}
    </div>
  )
}
