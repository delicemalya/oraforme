'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Analyse des flux — 7 jours</h3>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Factures payées par jour</p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
        }}>FCFA</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxis}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
            formatter={(val) => [`${fmtFull(Number(val))} FCFA`, 'Revenus']}
            cursor={{ stroke: 'rgba(245,30,51,0.2)', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="montant"
            stroke="#F51E33"
            strokeWidth={2}
            dot={hasData ? { fill: '#F51E33', r: 3, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#F51E33', stroke: 'rgba(245,30,51,0.25)', strokeWidth: 6 }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>

      {!hasData && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: -12 }}>
          Aucun revenu enregistré sur 7 jours
        </p>
      )}
    </div>
  )
}
