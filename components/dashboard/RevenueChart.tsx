'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DayData { day: string; montant: number; count: number }

function fmtAxis(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

export default function RevenueChart({ data }: { data: DayData[] }) {
  const hasData = data.some(d => d.montant > 0)

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Revenus — 7 derniers jours</h3>
          <p className="text-[10px] text-[#484F58] mt-0.5">Factures payées par jour</p>
        </div>
        <span className="text-[10px] font-semibold text-[#484F58] border border-[#21262D] rounded-lg px-2 py-1">FCFA</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#F0A30A" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#F0A30A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2128" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#484F58', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#484F58', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxis}
          />
          <Tooltip
            contentStyle={{
              background: '#1C2128',
              border: '1px solid #30363D',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 16px #00000040',
            }}
            labelStyle={{ color: '#8B949E', marginBottom: 4 }}
            formatter={(val) => [`${fmtFull(Number(val))} FCFA`, 'Revenus']}
            cursor={{ stroke: '#F0A30A22', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="montant"
            stroke="#F0A30A"
            strokeWidth={2}
            fill="url(#gradRevenu)"
            dot={hasData ? { fill: '#F0A30A', r: 3, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#F0A30A', stroke: '#F0A30A30', strokeWidth: 5 }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>

      {!hasData && (
        <p className="text-xs text-[#484F58] text-center -mt-4">
          Aucun revenu enregistré sur 7 jours
        </p>
      )}
    </div>
  )
}
