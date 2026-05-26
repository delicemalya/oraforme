'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useLocale } from '@/lib/hooks/useLocale'

interface Entry { name: string; value: number; color: string; statut?: string }

export default function ModuleChart({ data, title }: { data: Entry[]; title: string }) {
  const { t } = useLocale()
  const total = data.reduce((s, d) => s + d.value, 0)

  const normalizedData = data.map(d => ({
    ...d,
    color: d.color === '#0F172A' ? '#DC2626' : d.color,
    // invoice breakdown → translate via statut key; module names → resolve as i18n key if dotted
    name: d.statut
      ? t(`invoice.lbl.${d.statut}`)
      : (d.name.includes('.') ? t(d.name) : d.name),
  }))

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div className="mb-4">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t('dash.invoiceBreakdown')}</p>
      </div>

      {normalizedData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={normalizedData}
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
                {normalizedData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}
                formatter={(val) => [
                  `${val} (${Math.round((Number(val) / total) * 100)}%)`,
                  '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-1.5 mt-2">
            {normalizedData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px dashed var(--border)' }} />
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dash.noData')}</p>
        </div>
      )}
    </div>
  )
}
