'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Shared formatter ─────────────────────────────────────────────
function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

const TICK = { fill: '#6B7280', fontSize: 10 }
const GRID = { stroke: '#1a2d50', strokeDasharray: '3 3' }

// ── Area / multi-line trend ───────────────────────────────────────
interface TrendSeries { dataKey: string; color: string; label?: string }

export function BiTrendChart({
  data,
  series,
  height = 220,
}: {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={TICK} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          itemStyle={{ color: '#8B949E' }}
          formatter={(v: unknown) => new Intl.NumberFormat('fr-FR').format(Number(v)) + ' FCFA'}
        />
        {series.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8B949E' }} />
        )}
        {series.map(s => (
          <Area
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.label ?? s.dataKey}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.dataKey})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Vertical bar chart ────────────────────────────────────────────
interface BarSeries { dataKey: string; color: string; label?: string }

export function BiBarChart({
  data,
  series,
  height = 220,
}: {
  data: Record<string, unknown>[]
  series: BarSeries[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={TICK} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          itemStyle={{ color: '#8B949E' }}
          formatter={(v: unknown) => new Intl.NumberFormat('fr-FR').format(Number(v)) + ' FCFA'}
          cursor={{ fill: '#ffffff08' }}
        />
        {series.length > 1 && (
          <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8B949E' }} />
        )}
        {series.map(s => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label ?? s.dataKey} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Simple bar chart for count data (no FCFA) ────────────────────
export function BiCountBarChart({
  data,
  dataKey,
  color,
  height = 180,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  color: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="40%">
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          cursor={{ fill: '#ffffff08' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Donut chart ───────────────────────────────────────────────────
interface DonutSlice { name: string; value: number; color: string }

export function BiDonutChart({
  data,
  height = 200,
  innerRadius = 55,
  outerRadius = 82,
}: {
  data: DonutSlice[]
  height?: number
  innerRadius?: number
  outerRadius?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          paddingAngle={3}
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
          formatter={(v: unknown) => { const n = Number(v); return [`${n} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, ''] }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize={18} fontWeight={700}>
          {total}
        </text>
        <text x="50%" y="50%" dy={16} textAnchor="middle" dominantBaseline="middle" fill="#6B7280" fontSize={9}>
          total
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}
