'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export interface ExpenseCategory {
  name: string
  value: number
  color: string
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

const COLORS = ['#F08900', '#F08900', '#142850', '#8B0070', '#F08900', '#8B0070', '#142850', '#84CC16']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: d } = payload[0]
  return (
    <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-3 shadow-2xl text-xs">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
        <span className="text-[#FFFFFF] font-semibold">{name}</span>
      </div>
      <span className="text-[#8B949E]">{fmtFull(value)}</span>
    </div>
  )
}

export default function ExpensesChart({ data }: { data: ExpenseCategory[] }) {
  const hasData = data.some(d => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)
  const enriched = data.map((d, i) => ({ ...d, color: d.color || COLORS[i % COLORS.length] }))

  if (!hasData) {
    return (
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#FFFFFF] mb-1">Répartition des dépenses</h3>
        <p className="text-[10px] text-[#484F58] mb-6">Par catégorie ce mois</p>
        <div className="h-[180px] flex items-center justify-center text-xs text-[#484F58]">
          Aucune dépense enregistrée
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#FFFFFF]">Répartition des dépenses</h3>
          <p className="text-[10px] text-[#484F58] mt-0.5">Par catégorie ce mois · {fmtFull(total)}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={enriched}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {enriched.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 mt-2">
        {enriched.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-[#8B949E] truncate max-w-[120px]">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#FFFFFF] font-semibold">{fmtFull(item.value)}</span>
              <span className="text-[#484F58] w-8 text-right">{total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
