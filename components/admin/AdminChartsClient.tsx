'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { fmtFCFA } from '@/lib/admin-config'

type ModuleRevData = { module: string; clients: number; mrr: number }
type GrowthData = { date: string; inscriptions: number }

const RED = '#DC2626'
const ORANGE = '#DC2626'
const GREEN = '#0F172A'
const BLUE = '#DC2626'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-[var(--text-secondary)] mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{
            p.name === 'MRR' ? fmtFCFA(p.value) : p.value
          }</span>
        </p>
      ))}
    </div>
  )
}

export function ModuleRevenueChart({ data }: { data: ModuleRevData[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2d50" vertical={false} />
        <XAxis dataKey="module" tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} width={40} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1a2d50' }} />
        <Bar dataKey="clients" name="Clients" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="mrr" name="MRR" fill={RED} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GrowthChart({ data }: { data: GrowthData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2d50" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="inscriptions" name="Inscriptions" stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
