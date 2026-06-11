'use client'

import { useState } from 'react'
import { MODULE_LABELS, MODULE_PRICES, MODULE_ICONS, MODULE_DESCS } from '@/lib/admin-config'
import { useFmt } from '@/lib/hooks/useFmt'
import { Store, CheckCircle, Lock, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'

type ModuleInfo = {
  id: string
  label: string
  price: number
  icon: string
  desc: string
  active: boolean
}

export default function ModulesMarketplacePage() {
  const { fmt: fmtFCFA } = useFmt()
  // Use TenantContext as the single source of truth.
  // After each toggle we call tenant.reload() so the Sidebar re-renders immediately.
  const { tenant, loading, reload } = useTenantContext()
  const { t } = useLocale()

  const [toggling, setToggling] = useState<string | null>(null)
  const [confirm, setConfirm]   = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function toggleModule(moduleId: string, action: 'activate' | 'deactivate') {
    setToggling(moduleId)
    setConfirm(null)
    try {
      const res = await fetch('/api/modules/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Reload TenantContext → Sidebar + Header update without page refresh
      await reload()

      showToast(
        action === 'activate'
          ? `${MODULE_LABELS[moduleId]} ${t('modules.activate').toLowerCase()} !`
          : `${MODULE_LABELS[moduleId]} ${t('modules.deactivate').toLowerCase()}`,
        action === 'activate'
      )
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Erreur', false)
    } finally {
      setToggling(null)
    }
  }

  const modulesActifs = tenant?.modulesActifs ?? []

  const allModules: ModuleInfo[] = Object.keys(MODULE_LABELS).map(id => ({
    id,
    label: MODULE_LABELS[id],
    price: MODULE_PRICES[id] ?? 0,
    icon: MODULE_ICONS[id] ?? '📦',
    desc: MODULE_DESCS[id] ?? '',
    active: modulesActifs.includes(id),
  }))

  const activeList   = allModules.filter(m => m.active)
  const inactiveList = allModules.filter(m => !m.active)
  const mrrTotal     = activeList.reduce((s, m) => s + m.price, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
            <Store size={18} className="text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{t('modules.title')}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {activeList.length} {activeList.length > 1 ? t('modules.actives') : t('modules.active')} · {fmtFCFA(mrrTotal)}{t('modules.perMonth')}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Active modules */}
          {activeList.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">{t('modules.activeModules')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeList.map(m => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    toggling={toggling === m.id}
                    onAction={() => setConfirm({ id: m.id, action: 'deactivate' })}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive modules */}
          {inactiveList.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">{t('modules.available')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveList.map(m => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    toggling={toggling === m.id}
                    onAction={() => setConfirm({ id: m.id, action: 'activate' })}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setConfirm(null)}
                className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
              <div className="text-3xl mb-3">{MODULE_ICONS[confirm.id]}</div>
              <h3 className="text-base font-bold text-[var(--text)] mb-1">
                {confirm.action === 'activate' ? t('modules.activate') : t('modules.deactivate')} {MODULE_LABELS[confirm.id]} ?
              </h3>
              {confirm.action === 'activate' ? (
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  {t('modules.confirmActivate')}
                  {' '}{t('modules.tarif')}{' '}
                  <span className="text-[var(--primary)] font-medium">
                    {fmtFCFA(MODULE_PRICES[confirm.id] ?? 0)}{t('modules.perMonth')}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  {t('modules.confirmDeactivate')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => toggleModule(confirm.id, confirm.action)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    confirm.action === 'activate'
                      ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                      : 'bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/20'
                  }`}
                >
                  {confirm.action === 'activate' ? t('modules.activate') : t('modules.deactivate')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
              toast.ok
                ? 'bg-[var(--success-light)] border-[var(--success)]/30 text-[var(--success-text)]'
                : 'bg-[var(--danger-light)] border-[var(--danger)]/30 text-[var(--danger-text)]'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

function ModuleCard({
  module: m, toggling, onAction, t,
}: {
  module: ModuleInfo
  toggling: boolean
  onAction: () => void
  t: (key: string) => string
}) {
  const { fmt: fmtFCFA } = useFmt()
  return (
    <div className={`bg-[var(--surface)] border rounded-xl p-5 transition-all ${
      m.active
        ? 'border-[var(--success)]/30 shadow-sm'
        : 'border-[var(--border)] hover:border-[var(--border-strong)]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{m.icon}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{m.label}</p>
            <p className="text-xs text-[var(--primary)] font-medium">{fmtFCFA(m.price)}{t('modules.perMonth')}</p>
          </div>
        </div>
        {m.active
          ? <CheckCircle size={16} className="text-[var(--success)] shrink-0 mt-0.5" />
          : <Lock size={14} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
        }
      </div>

      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-2">{m.desc}</p>

      <button
        onClick={onAction}
        disabled={toggling}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          m.active
            ? 'bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)]/30'
            : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
        }`}
      >
        {toggling
          ? <Loader2 size={13} className="animate-spin" />
          : m.active
          ? t('modules.deactivate')
          : `${t('modules.activate')} — ${fmtFCFA(m.price)}${t('modules.perMonth')}`
        }
      </button>
    </div>
  )
}
