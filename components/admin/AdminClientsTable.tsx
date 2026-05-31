'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ExternalLink, PauseCircle, PlayCircle, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react'
import { MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'
import { motion, AnimatePresence } from 'framer-motion'

type TenantRow = {
  id: string
  nom_entreprise: string
  plan: string
  modules_actifs: string[]
  nb_users: number
  nb_factures: number
  ca_genere: number
  created_at: string
  status?: 'active' | 'suspended'
}

type Confirm =
  | { type: 'suspend'; tenant: TenantRow }
  | { type: 'unsuspend'; tenant: TenantRow }
  | { type: 'delete'; tenant: TenantRow }

const PLAN_COLORS: Record<string, string> = {
  starter:  'text-[var(--text-secondary)] bg-[var(--surface-alt)] border-[var(--border)]',
  business: 'text-[var(--info)] bg-[var(--info-light)] border-[var(--info)]/30',
  premium:  'text-[var(--primary)] bg-[var(--primary-light)] border-[var(--primary)]/30',
}

export default function AdminClientsTable({ tenants: initialTenants }: { tenants: TenantRow[] }) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants)
  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [confirm, setConfirm]       = useState<Confirm | null>(null)
  const [acting, setActing]         = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  const filtered = tenants.filter(t => {
    if (search && !t.nom_entreprise.toLowerCase().includes(search.toLowerCase())) return false
    if (planFilter !== 'all' && t.plan !== planFilter) return false
    if (moduleFilter !== 'all' && !t.modules_actifs.includes(moduleFilter)) return false
    return true
  })

  const allModules = Object.keys(MODULE_LABELS)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function executeAction() {
    if (!confirm) return
    setActing(true)
    try {
      let res: Response

      if (confirm.type === 'delete') {
        res = await fetch('/api/admin/tenant', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: confirm.tenant.id, confirm: true }),
        })
      } else {
        res = await fetch('/api/admin/tenant', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: confirm.tenant.id,
            action: confirm.type === 'suspend' ? 'suspend' : 'unsuspend',
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (confirm.type === 'delete') {
        setTenants(prev => prev.filter(t => t.id !== confirm.tenant.id))
        showToast(`${confirm.tenant.nom_entreprise} supprimée`, true)
      } else {
        const newStatus = confirm.type === 'suspend' ? 'suspended' : 'active'
        setTenants(prev => prev.map(t => t.id === confirm.tenant.id ? { ...t, status: newStatus } : t))
        showToast(
          confirm.type === 'suspend'
            ? `${confirm.tenant.nom_entreprise} suspendue`
            : `${confirm.tenant.nom_entreprise} réactivée`,
          true
        )
      }
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Erreur', false)
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="text-[var(--text-secondary)] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher entreprise..."
            className="bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none flex-1"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] outline-none"
        >
          <option value="all">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] outline-none"
        >
          <option value="all">Tous les modules</option>
          {allModules.map(m => (
            <option key={m} value={m}>{MODULE_LABELS[m]}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--text-secondary)] self-center ml-auto">
          {filtered.length} / {tenants.length} client{tenants.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Entreprise</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Plan</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Modules</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Users</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Factures</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">CA généré</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Inscription</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Statut</th>
              <th className="px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-[var(--text-secondary)] text-sm">Aucun client trouvé</td>
              </tr>
            )}
            {filtered.map(t => {
              const isSuspended = t.status === 'suspended'
              return (
                <tr key={t.id} className={`transition-colors ${isSuspended ? 'bg-[var(--danger-light)]/30' : 'bg-[var(--surface)] hover:bg-[var(--surface-alt)]'}`}>
                  <td className="px-4 py-3">
                    <p className={`font-medium truncate max-w-[160px] ${isSuspended ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text)]'}`}>
                      {t.nom_entreprise}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-[160px]">{t.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${PLAN_COLORS[t.plan] ?? PLAN_COLORS.starter}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {t.modules_actifs.slice(0, 3).map(m => (
                        <span key={m} className="text-[10px] bg-[var(--surface-alt)] text-[var(--text-secondary)] rounded px-1.5 py-0.5">
                          {MODULE_LABELS[m] ?? m}
                        </span>
                      ))}
                      {t.modules_actifs.length > 3 && (
                        <span className="text-[10px] text-[var(--text-secondary)]">+{t.modules_actifs.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-[var(--text)]">{t.nb_users}</td>
                  <td className="px-3 py-3 text-right text-[var(--text)]">{t.nb_factures}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--success)]">{fmtFCFA(t.ca_genere)}</td>
                  <td className="px-3 py-3 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isSuspended
                        ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                        : 'bg-[var(--success-light)] text-[var(--success-text)]'
                    }`}>
                      {isSuspended ? 'Suspendu' : 'Actif'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/clients/${t.id}`}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--info)] hover:bg-[var(--info-light)] transition-colors"
                        title="Voir le détail"
                      >
                        <ExternalLink size={13} />
                      </Link>
                      {isSuspended ? (
                        <button
                          onClick={() => setConfirm({ type: 'unsuspend', tenant: t })}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--success)] hover:bg-[var(--success-light)] transition-colors"
                          title="Réactiver"
                        >
                          <PlayCircle size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ type: 'suspend', tenant: t })}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--warning)] hover:bg-[var(--warning-light)] transition-colors"
                          title="Suspendre"
                        >
                          <PauseCircle size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirm({ type: 'delete', tenant: t })}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => !acting && setConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <button
                onClick={() => setConfirm(null)}
                disabled={acting}
                className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
              >
                <X size={16} />
              </button>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                confirm.type === 'delete' ? 'bg-[var(--danger-light)]' :
                confirm.type === 'suspend' ? 'bg-[var(--warning-light)]' :
                'bg-[var(--success-light)]'
              }`}>
                {confirm.type === 'delete'   && <Trash2 size={18} className="text-[var(--danger)]" />}
                {confirm.type === 'suspend'  && <AlertTriangle size={18} className="text-[var(--warning)]" />}
                {confirm.type === 'unsuspend'&& <PlayCircle size={18} className="text-[var(--success)]" />}
              </div>

              <h3 className="text-base font-bold text-[var(--text)] mb-1">
                {confirm.type === 'delete'    && 'Supprimer l\'entreprise ?'}
                {confirm.type === 'suspend'   && 'Suspendre l\'accès ?'}
                {confirm.type === 'unsuspend' && 'Réactiver l\'accès ?'}
              </h3>

              <p className="text-sm text-[var(--text-secondary)] mb-1">
                <span className="font-semibold text-[var(--text)]">{confirm.tenant.nom_entreprise}</span>
              </p>

              <p className="text-xs text-[var(--text-secondary)] mb-5">
                {confirm.type === 'delete' && (
                  <>
                    ⚠️ Cette action <strong>marque le compte comme supprimé</strong>. Les données sont conservées en base.
                    Pour une suppression définitive, utilisez le panneau Supabase.
                  </>
                )}
                {confirm.type === 'suspend' && 'Les utilisateurs de cette entreprise ne pourront plus accéder à leur tableau de bord.'}
                {confirm.type === 'unsuspend' && 'L\'entreprise retrouvera immédiatement l\'accès complet à la plateforme.'}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={acting}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  onClick={executeAction}
                  disabled={acting}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${
                    confirm.type === 'delete'
                      ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90'
                      : confirm.type === 'suspend'
                      ? 'bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90'
                      : 'bg-[var(--success)] text-white hover:bg-[var(--success)]/90'
                  }`}
                >
                  {acting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {confirm.type === 'delete'    && 'Supprimer'}
                  {confirm.type === 'suspend'   && 'Suspendre'}
                  {confirm.type === 'unsuspend' && 'Réactiver'}
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
