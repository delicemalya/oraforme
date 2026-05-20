'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MODULE_LABELS, MODULE_PRICES, MODULE_ICONS, MODULE_DESCS, fmtFCFA } from '@/lib/admin-config'
import { Store, CheckCircle, Lock, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type ModuleInfo = {
  id: string
  label: string
  price: number
  icon: string
  desc: string
  active: boolean
}

export default function ModulesMarketplacePage() {
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('tenant_id, tenants(modules_actifs)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data?.tenant_id) setTenantId(data.tenant_id)
      const t = data?.tenants as unknown as { modules_actifs: string[] } | null
      setModulesActifs(t?.modules_actifs ?? [])
      setLoading(false)
    })
  }, [])

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
      setModulesActifs(data.modules_actifs)
      showToast(
        action === 'activate'
          ? `${MODULE_LABELS[moduleId]} activé !`
          : `${MODULE_LABELS[moduleId]} désactivé`,
        action === 'activate'
      )
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Erreur', false)
    } finally {
      setToggling(null)
    }
  }

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
          <div className="w-10 h-10 rounded-xl bg-[#F51E33]/10 border border-[#F51E33]/20 flex items-center justify-center">
            <Store size={18} className="text-[#F51E33]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#FFFFFF]">Modules</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {activeList.length} actif{activeList.length > 1 ? 's' : ''} · {fmtFCFA(mrrTotal)}/mois
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Active modules */}
          {activeList.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">Modules actifs</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeList.map(m => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    toggling={toggling === m.id}
                    onAction={() => setConfirm({ id: m.id, action: 'deactivate' })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive modules */}
          {inactiveList.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-1">Modules disponibles</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveList.map(m => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    toggling={toggling === m.id}
                    onAction={() => setConfirm({ id: m.id, action: 'activate' })}
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
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <button onClick={() => setConfirm(null)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]">
                <X size={16} />
              </button>
              <div className="text-3xl mb-3">{MODULE_ICONS[confirm.id]}</div>
              <h3 className="text-base font-bold text-[#FFFFFF] mb-1">
                {confirm.action === 'activate' ? 'Activer' : 'Désactiver'} {MODULE_LABELS[confirm.id]} ?
              </h3>
              {confirm.action === 'activate' ? (
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Ce module sera immédiatement accessible dans votre sidebar.
                  Tarif : <span className="text-[#F51E33] font-medium">{fmtFCFA(MODULE_PRICES[confirm.id] ?? 0)}/mois</span>
                </p>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Le module sera retiré de votre sidebar. Vos données sont conservées.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#1a2d50] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#FFFFFF] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => toggleModule(confirm.id, confirm.action)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    confirm.action === 'activate'
                      ? 'bg-[#F51E33] text-[#F51E33] hover:bg-[#F51E33]/90'
                      : 'bg-[#F51E33]/10 border border-[#F51E33]/30 text-[#F51E33] hover:bg-[#F51E33]/20'
                  }`}
                >
                  {confirm.action === 'activate' ? 'Activer' : 'Désactiver'}
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
                ? 'bg-[#2EA043]/10 border-[#2EA043]/30 text-[#2EA043]'
                : 'bg-[#F51E33]/10 border-[#F51E33]/30 text-[#F51E33]'
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
  module: m, toggling, onAction,
}: {
  module: ModuleInfo
  toggling: boolean
  onAction: () => void
}) {
  return (
    <div className={`bg-[var(--card-bg)] border rounded-xl p-5 transition-all ${
      m.active ? 'border-[#2EA043]/30' : 'border-[var(--border)] hover:border-[#484F58]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{m.icon}</span>
          <div>
            <p className="text-sm font-semibold text-[#FFFFFF]">{m.label}</p>
            <p className="text-xs text-[#F51E33] font-medium">{fmtFCFA(m.price)}/mois</p>
          </div>
        </div>
        {m.active
          ? <CheckCircle size={16} className="text-[#2EA043] shrink-0 mt-0.5" />
          : <Lock size={14} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
        }
      </div>

      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-2">{m.desc}</p>

      <button
        onClick={onAction}
        disabled={toggling}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          m.active
            ? 'bg-[#1a2d50] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#F51E33] hover:border-[#F51E33]/30'
            : 'bg-[#F51E33] text-[#F51E33] hover:bg-[#F51E33]/90'
        }`}
      >
        {toggling
          ? <Loader2 size={13} className="animate-spin" />
          : m.active
          ? 'Désactiver'
          : `Activer — ${fmtFCFA(m.price)}/mois`
        }
      </button>
    </div>
  )
}
