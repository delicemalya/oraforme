'use client'
import { useLocale } from '@/lib/hooks/useLocale'
/**
 * ERPPageLayout — Layout universel pour TOUTES les pages métier Oraforme.
 *
 * Usage :
 *  <ERPPageLayout
 *    title="RH & Paie"
 *    subtitle="Gestion du personnel"
 *    icon={<Users size={18} />}
 *    color="#64748B"
 *    actions={<Button>{t('common.create')}</Button>}
 *    kpis={[...]}
 *    tabs={[...]}
 *    activeTab={...}
 *    onTabChange={...}
 *  >
 *    {children}
 *  </ERPPageLayout>
 */

import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ERPKpi {
  label:  string
  value:  string | number
  sub?:   string
  color?: string
  icon?:  React.ReactNode
  trend?: { value: number; positive: boolean }
}

export interface ERPTab {
  id:     string
  label:  string
  icon?:  React.ReactNode
  badge?: string | number
}

interface ERPPageLayoutProps {
  title:       string
  subtitle?:   string
  icon?:       React.ReactNode
  color?:      string
  actions?:    React.ReactNode
  kpis?:       ERPKpi[]
  tabs?:       ERPTab[]
  activeTab?:  string
  onTabChange?: (id: string) => void
  children:    React.ReactNode
  className?:  string
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

export function ERPKpiCard({ kpi }: { kpi: ERPKpi }) {
  const color = kpi.color ?? '#F59E0B'
  return (
    <div className="bg-white rounded-2xl border border-[var(--border,#E2E8F0)] p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        {kpi.icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
            <span style={{ color }}>{kpi.icon}</span>
          </div>
        )}
        {kpi.trend && (
          <span className={`text-[11px] font-bold ml-auto flex items-center gap-0.5 ${kpi.trend.positive ? 'text-green-600' : 'text-red-500'}`}>
            {kpi.trend.positive ? '↑' : '↓'} {Math.abs(kpi.trend.value)}%
          </span>
        )}
      </div>
      <p className="text-[20px] font-bold text-[var(--text,#0F172A)] leading-tight tabular-nums">{kpi.value}</p>
      <p className="text-[12px] text-[var(--text-secondary,#64748B)] mt-0.5 leading-snug font-medium">{kpi.label}</p>
      {kpi.sub && <p className="text-[10px] text-[var(--text-secondary,#64748B)] mt-0.5 opacity-70">{kpi.sub}</p>}
    </div>
  )
}

// ── KPI Grid ──────────────────────────────────────────────────────────────────

export function ERPKpiGrid({ kpis, cols = 4 }: { kpis: ERPKpi[]; cols?: 2 | 3 | 4 | 5 }) {
  const colClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
  }
  return (
    <div className={`grid ${colClass[cols]} gap-4`}>
      {kpis.map((kpi, i) => <ERPKpiCard key={i} kpi={kpi} />)}
    </div>
  )
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

export function ERPTabBar({
  tabs, active, onChange,
}: { tabs: ERPTab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--border,#E2E8F0)] overflow-x-auto pb-0 scrollbar-hide">
      {tabs.map(tab => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
              isActive
                ? 'border-[#F59E0B] text-[#F59E0B]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                isActive ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Data Table ────────────────────────────────────────────────────────────────

export interface ERPColumn<T> {
  key:      string
  label:    string
  width?:   string
  render?:  (row: T) => React.ReactNode
  align?:   'left' | 'center' | 'right'
}

export function ERPDataTable<T extends Record<string, unknown>>({
  columns, rows, emptyLabel = 'Aucune donnée',
  onRowClick,
}: {
  columns:     ERPColumn<T>[]
  rows:        T[]
  emptyLabel?: string
  onRowClick?: (row: T) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="bg-[var(--surface-alt,#F8FAFC)]">
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`px-5 py-3 text-[11px] font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wide text-${col.align ?? 'left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center text-[12px] text-[var(--text-secondary,#64748B)]">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-[var(--border,#E2E8F0)] hover:bg-[var(--surface-alt,#F8FAFC)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-5 py-3 text-${col.align ?? 'left'}`}>
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function ERPEmptyState({
  icon, title, description, action,
}: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-[var(--border,#E2E8F0)] mb-4 opacity-60">{icon}</div>}
      <p className="text-[14px] font-semibold text-[var(--text,#0F172A)]">{title}</p>
      {description && <p className="text-[12px] text-[var(--text-secondary,#64748B)] mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border-green-200',
  inactive:  'bg-gray-100 text-gray-500 border-gray-200',
  pending:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  error:     'bg-red-50 text-red-600 border-red-200',
  success:   'bg-green-50 text-green-700 border-green-200',
  warning:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  info:      'bg-blue-50 text-blue-700 border-blue-200',
}

export function ERPStatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.inactive
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label ?? status}
    </span>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────────

export function ERPSectionCard({
  title, actions, children, className = '',
}: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[var(--border,#E2E8F0)] shadow-sm overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-[var(--border,#E2E8F0)] flex items-center justify-between">
          {title && <h3 className="text-[14px] font-bold text-[var(--text,#0F172A)]">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

// ── Main Layout ───────────────────────────────────────────────────────────────

export default function ERPPageLayout({
  title, subtitle, icon, color = '#F59E0B', actions,
  kpis, tabs, activeTab, onTabChange,
  children, className = '',
}: ERPPageLayoutProps) {
  const { t: _t } = useLocale()
  return (
    <div className={`space-y-5 ${className}`}>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: color + '18', border: `1.5px solid ${color}30` }}
            >
              <span style={{ color }}>{icon}</span>
            </div>
          )}
          <div>
            <h1 className="text-[20px] lg:text-[22px] font-bold text-[var(--text,#0F172A)] leading-tight">{title}</h1>
            {subtitle && <p className="text-[12px] text-[var(--text-secondary,#64748B)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>

      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <ERPKpiGrid kpis={kpis} cols={Math.min(kpis.length, 4) as 2 | 3 | 4} />
      )}

      {/* Tabs */}
      {tabs && tabs.length > 0 && activeTab && onTabChange && (
        <ERPTabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      )}

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}
