'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Clock, CheckCircle, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

type StatutCmd = 'en_attente' | 'en_preparation' | 'pret' | 'livre' | 'annule'
interface CmdItem { nom: string; quantite: number; prix: number }
interface Commande {
  id: string
  table_num: string
  mode: string
  items: CmdItem[]
  statut: StatutCmd
  total: number
  client_nom: string | null
  note_client: string | null
  source: string
  created_at: string
}

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

const NEXT_STATUS: Partial<Record<StatutCmd, StatutCmd>> = {
  en_attente:     'en_preparation',
  en_preparation: 'pret',
  pret:           'livre',
}

const STATUS_CONFIG: Partial<Record<StatutCmd, { label: string; color: string; bg: string; border: string }>> = {
  en_attente:    { label: 'En attente',     color: '#DC2626', bg: '#DC262618', border: '#DC262640' },
  en_preparation:{ label: 'En préparation', color: '#DC2626', bg: '#DC262618', border: '#DC262640' },
  pret:          { label: 'Prêt à servir',  color: '#16A34A', bg: '#16A34A18', border: '#16A34A40' },
  livre:         { label: 'Livré',          color: '#7C3AED', bg: '#7C3AED18', border: '#7C3AED40' },
}

export default function CuisinePage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading,   setLoading]   = useState(true)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('resto_commandes')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('statut', ['en_attente', 'en_preparation', 'pret'])
      .order('created_at')
    setCommandes((data ?? []) as Commande[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  async function advance(cmd: Commande) {
    const next = NEXT_STATUS[cmd.statut]
    if (!next) return
    setAdvancing(cmd.id)
    await supabase.from('resto_commandes').update({ statut: next }).eq('id', cmd.id)
    setCommandes(prev => prev.map(c => c.id === cmd.id ? { ...c, statut: next } : c))
    if (next === 'livre') {
      setTimeout(() => setCommandes(prev => prev.filter(c => c.id !== cmd.id)), 2000)
    }
    setAdvancing(null)
  }

  const byStatus = {
    en_attente:     commandes.filter(c => c.statut === 'en_attente'),
    en_preparation: commandes.filter(c => c.statut === 'en_preparation'),
    pret:           commandes.filter(c => c.statut === 'pret'),
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#DC2626]" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DC2626]/15 flex items-center justify-center">
            <ChefHat size={20} className="text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#101729]">Écran Cuisine</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {commandes.length} commande(s) active(s) · Mise à jour auto toutes les 10s
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 text-xs transition-colors"
        >
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* Columns */}
      {commandes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
          <ChefHat size={40} className="opacity-20 mb-3" />
          <p className="text-sm">Aucune commande en attente</p>
          <p className="text-xs mt-1 opacity-60">La liste s&apos;actualise automatiquement</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['en_attente', 'en_preparation', 'pret'] as const).map(status => {
            const cfg = STATUS_CONFIG[status]!
            const cmds = byStatus[status]
            return (
              <div key={status}>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span
                    className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: cfg.color, color: '#0F172A' }}
                  >
                    {cmds.length}
                  </span>
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                    {cmds.map(cmd => {
                      const next = NEXT_STATUS[cmd.statut]
                      const nextCfg = next ? STATUS_CONFIG[next] : null
                      return (
                        <motion.div
                          key={cmd.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="rounded-xl border p-4 space-y-3"
                          style={{ background: cfg.bg, borderColor: cfg.border }}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-[#101729]">
                                {cmd.table_num ? `Table ${cmd.table_num}` : (cmd.client_nom || 'Client')}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] capitalize">
                                {cmd.mode?.replace('_', ' ')}
                                {cmd.source === 'en_ligne' && ' · 🌐 En ligne'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
                              <Clock size={11} />
                              <span>{timeAgo(cmd.created_at)}</span>
                            </div>
                          </div>

                          {/* Items */}
                          <div className="space-y-1.5">
                            {(cmd.items as CmdItem[]).map((item, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm text-[#101729]">
                                  <span className="font-bold text-[#DC2626] mr-1">{item.quantite}×</span>
                                  {item.nom}
                                </span>
                              </div>
                            ))}
                          </div>

                          {cmd.note_client && (
                            <p className="text-xs text-[#DC2626] bg-[#DC2626]/10 rounded-lg px-2.5 py-1.5">
                              📝 {cmd.note_client}
                            </p>
                          )}

                          {/* Action */}
                          {next && nextCfg && (
                            <motion.button
                              onClick={() => advance(cmd)}
                              disabled={advancing === cmd.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                              style={{ background: nextCfg.color, color: '#0F172A' }}
                            >
                              {advancing === cmd.id ? (
                                <Loader2 className="animate-spin" size={13} />
                              ) : status === 'pret' ? (
                                <><CheckCircle size={13} /> Marquer livré</>
                              ) : (
                                <><ArrowRight size={13} /> {nextCfg.label}</>
                              )}
                            </motion.button>
                          )}
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {cmds.length === 0 && (
                    <div className="text-center py-8 text-[var(--text-secondary)] text-xs border border-dashed border-[var(--border)] rounded-xl">
                      Aucune commande
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
