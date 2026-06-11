'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

interface DayData { day: string; montant: number; count: number }

// Map Oraforme locale codes → BCP 47 locale tags for Intl
const LOCALE_TO_INTL: Record<string, string> = {
  fr: 'fr-FR', en: 'en-US', pt: 'pt-BR', es: 'es-ES',
  de: 'de-DE', ln: 'fr-CD', sw: 'sw-TZ', kg: 'fr-CG',
}

// Reference Sunday (2023-01-01 is a Sunday)
const REF_SUNDAY = new Date('2023-01-01T12:00:00Z')

function getDayLabel(dayIndex: string, intlLocale: string): string {
  const idx = parseInt(dayIndex, 10)
  if (isNaN(idx)) return dayIndex // fallback: return as-is
  const d = new Date(REF_SUNDAY)
  d.setDate(d.getDate() + idx)
  return new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(d)
}

function fmtAxis(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export default function RevenueChart({ data }: { data: DayData[] }) {
  const { fmt: fmtFull, devise } = useFmt()
  const { t, locale } = useLocale()
  const intlLocale = LOCALE_TO_INTL[locale] ?? 'fr-FR'
  const hasData = data.some(d => d.montant > 0)

  // Map day indices to locale-appropriate short names
  const localizedData = data.map(d => ({
    ...d,
    day: getDayLabel(d.day, intlLocale),
  }))

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('dash.cashflow')} — 7 {t('common.day').toLowerCase()}s
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {t('dash.billedInvoices')}
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
        }}>{devise}</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={localizedData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
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
            formatter={(val) => [fmtFull(Number(val)), t('dash.revenue')]}
            cursor={{ stroke: 'rgba(245,30,51,0.2)', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="montant"
            stroke="#DC2626"
            strokeWidth={2}
            dot={hasData ? { fill: '#DC2626', r: 3, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#DC2626', stroke: 'rgba(245,30,51,0.25)', strokeWidth: 6 }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>

      {!hasData && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: -12 }}>
          {t('dash.noData')}
        </p>
      )}
    </div>
  )
}
