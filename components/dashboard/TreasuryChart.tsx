'use client'

import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export interface MonthData {
  mois: string
  entrees: number
  sorties: number
  solde: number
}

function fmtAxis(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[var(--text-secondary)] font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--text-secondary)]">{p.name}:</span>
          <span className="text-[#FFFFFF] font-bold">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TreasuryChart({ data }: { data: MonthData[] }) {
  const hasData = data.some(d => d.entrees > 0 || d.sorties > 0)

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-[#FFFFFF]">Trésorerie — 12 mois</h3>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Entrées · Sorties · Solde cumulé</p>
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#142850] inline-block" />Entrées</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F51E33] inline-block" />Sorties</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F51E33] inline-block" />Solde</span>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-[var(--text-secondary)]">
          Aucune transaction enregistrée sur 12 mois
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradEntrees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#142850" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#142850" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSolde" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F51E33" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#F51E33" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1C2128" vertical={false} />
            <XAxis dataKey="mois" tick={{ fill: '#484F58', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#484F58', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="entrees" name="Entrées" fill="#142850" opacity={0.7} radius={[3,3,0,0]} barSize={12} />
            <Bar dataKey="sorties" name="Sorties" fill="#F51E33" opacity={0.7} radius={[3,3,0,0]} barSize={12} />
            <Area type="monotone" dataKey="solde" name="Solde" stroke="#F51E33" strokeWidth={2.5} fill="url(#gradSolde)" dot={false} activeDot={{ r: 5, fill: '#F51E33' }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
