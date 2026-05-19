'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export interface ClientRevenue {
  nom: string
  montant: number
  count: number
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

const GOLD = '#F08900'
const GOLDS = ['#F08900', '#E09000', '#C07800', '#A06000', '#805000']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[#FFFFFF] font-semibold mb-1 truncate max-w-[160px]">{label}</p>
      <p className="text-[#F08900]">{fmtFull(payload[0].value)}</p>
      {payload[0].payload.count && (
        <p className="text-[#484F58] mt-0.5">{payload[0].payload.count} facture(s)</p>
      )}
    </div>
  )
}

export default function TopClientsChart({ data }: { data: ClientRevenue[] }) {
  const hasData = data.some(d => d.montant > 0)

  return (
    <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-[#FFFFFF]">Top 5 Clients</h3>
          <p className="text-[10px] text-[#484F58] mt-0.5">Par chiffre d'affaires ce mois</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[180px] flex items-center justify-center text-xs text-[#484F58]">
          Aucun client avec facturation ce mois
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#484F58', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
              <YAxis type="category" dataKey="nom" tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="montant" radius={[0, 4, 4, 0]} barSize={16}>
                {data.slice(0, 5).map((_, i) => (
                  <Cell key={i} fill={GOLDS[i] ?? GOLD} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {data.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: (GOLDS[i] ?? GOLD) + '20', color: GOLDS[i] ?? GOLD }}>
                    {i + 1}
                  </span>
                  <span className="text-[#8B949E] truncate max-w-[120px]">{c.nom}</span>
                </div>
                <span className="text-[#FFFFFF] font-semibold">{fmtFull(c.montant)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
