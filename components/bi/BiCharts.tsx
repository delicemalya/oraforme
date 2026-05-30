'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, ReferenceLine,
} from 'recharts'

// ── Theme presets ─────────────────────────────────────────────────
type ChartTheme = 'dark' | 'light'

function getTheme(t: ChartTheme) {
  if (t === 'light') return {
    tick:    { fill: '#6B7280', fontSize: 10 },
    grid:    { stroke: '#E5E7EB', strokeDasharray: '3 3' },
    tooltip: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 11 },
    label:   { color: '#0F172A', fontWeight: 600 },
    item:    { color: '#6B7280' },
    text:    '#0F172A',
    textSub: '#6B7280',
  }
  return {
    tick:    { fill: '#6B7280', fontSize: 10 },
    grid:    { stroke: '#1a2d50', strokeDasharray: '3 3' },
    tooltip: { background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 },
    label:   { color: '#FFFFFF', fontWeight: 600 },
    item:    { color: '#64748B' },
    text:    '#FFFFFF',
    textSub: '#6B7280',
  }
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

// ── Area / multi-line trend ───────────────────────────────────────
interface TrendSeries { dataKey: string; color: string; label?: string }

export function BiTrendChart({
  data,
  series,
  height = 220,
  theme = 'dark',
  xKey = 'month',
  formatter,
}: {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  height?: number
  theme?: ChartTheme
  xKey?: string
  formatter?: (v: number) => string
}) {
  const th = getTheme(theme)
  const fmt = formatter ?? ((v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...th.grid} />
        <XAxis dataKey={xKey} tick={th.tick} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={th.tick} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={th.tooltip}
          labelStyle={th.label}
          itemStyle={th.item}
          formatter={(v: unknown) => fmt(Number(v))}
        />
        {series.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: th.textSub }} />
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
  theme = 'dark',
  xKey = 'month',
  formatter,
}: {
  data: Record<string, unknown>[]
  series: BarSeries[]
  height?: number
  theme?: ChartTheme
  xKey?: string
  formatter?: (v: number) => string
}) {
  const th = getTheme(theme)
  const fmt = formatter ?? ((v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid {...th.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={th.tick} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={th.tick} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={th.tooltip}
          labelStyle={th.label}
          itemStyle={th.item}
          formatter={(v: unknown) => fmt(Number(v))}
          cursor={{ fill: theme === 'light' ? '#F5F7FB' : '#ffffff08' }}
        />
        {series.length > 1 && (
          <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: th.textSub }} />
        )}
        {series.map(s => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label ?? s.dataKey} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Simple bar chart for count data ──────────────────────────────
export function BiCountBarChart({
  data,
  dataKey,
  color,
  height = 180,
  theme = 'dark',
  xKey = 'month',
}: {
  data: Record<string, unknown>[]
  dataKey: string
  color: string
  height?: number
  theme?: ChartTheme
  xKey?: string
}) {
  const th = getTheme(theme)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="40%">
        <CartesianGrid {...th.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={th.tick} axisLine={false} tickLine={false} />
        <YAxis tick={th.tick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={th.tooltip}
          labelStyle={th.label}
          cursor={{ fill: theme === 'light' ? '#F5F7FB' : '#ffffff08' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Composed chart (bars + line) ──────────────────────────────────
export function BiComposedChart({
  data,
  bars = [],
  lines = [],
  height = 240,
  theme = 'light',
  xKey = 'month',
  formatter,
}: {
  data: Record<string, unknown>[]
  bars?: BarSeries[]
  lines?: TrendSeries[]
  height?: number
  theme?: ChartTheme
  xKey?: string
  formatter?: (v: number) => string
}) {
  const th = getTheme(theme)
  const fmt = formatter ?? ((v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...th.grid} />
        <XAxis dataKey={xKey} tick={th.tick} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={th.tick} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={th.tooltip}
          labelStyle={th.label}
          itemStyle={th.item}
          formatter={(v: unknown) => fmt(Number(v))}
          cursor={{ fill: theme === 'light' ? '#F5F7FB' : '#ffffff08' }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: th.textSub }} />
        <ReferenceLine y={0} stroke={theme === 'light' ? '#E5E7EB' : '#2D3748'} strokeWidth={1} />
        {bars.map(s => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label ?? s.dataKey} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        ))}
        {lines.map(s => (
          <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.label ?? s.dataKey} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color }} />
        ))}
      </ComposedChart>
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
  theme = 'dark',
}: {
  data: DonutSlice[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  theme?: ChartTheme
}) {
  const th = getTheme(theme)
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
          contentStyle={th.tooltip}
          formatter={(v: unknown) => { const n = Number(v); return [`${n} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, ''] }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={th.text} fontSize={18} fontWeight={700}>
          {total}
        </text>
        <text x="50%" y="50%" dy={16} textAnchor="middle" dominantBaseline="middle" fill={th.textSub} fontSize={9}>
          total
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Mini sparkline ────────────────────────────────────────────────
export function BiSparkline({
  data,
  dataKey,
  color,
  height = 40,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  color: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
