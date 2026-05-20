'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, RefreshCw, Download, BookOpen, TrendingUp, BarChart2, Check, Wallet, ArrowUpCircle, ArrowDownCircle, Sparkles, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import { fmt, KpiCard, FI } from '../_lib/shared'

type SubTab = 'journal' | 'grandlivre' | 'bilan' | 'tresorerie' | 'previsions'

const SUB_TABS = [
  { id: 'journal'    as SubTab, label: 'Journal OHADA', icon: BookOpen  },
  { id: 'grandlivre' as SubTab, label: 'Grand Livre',   icon: TrendingUp},
  { id: 'bilan'      as SubTab, label: 'Bilan',         icon: BarChart2 },
  { id: 'tresorerie' as SubTab, label: 'Trésorerie',    icon: Wallet    },
  { id: 'previsions' as SubTab, label: 'Prévisions IA', icon: Sparkles  },
]

interface JournalEntry {
  id: string; date: string; libelle: string; type: string
  montant_ht: number; tva: number; montant_ttc: number
  categorie: string; created_at: string
}

// Comptes OHADA pour l'éducation
const COMPTES_OHADA = [
  // Produits
  { code: '701', label: 'Ventes de marchandises — Scolarité' },
  { code: '706', label: 'Prestations de services' },
  { code: '709', label: 'Autres produits' },
  { code: '773', label: 'Subventions et dons' },
  // Charges de personnel
  { code: '621', label: 'Sous-traitance / Honoraires' },
  { code: '641', label: 'Rémunérations du personnel' },
  { code: '642', label: 'Charges sociales' },
  { code: '644', label: 'Charges sociales patronales' },
  // Autres charges
  { code: '601', label: 'Achats de marchandises' },
  { code: '625', label: 'Déplacements, missions, réceptions' },
  { code: '627', label: 'Frais bancaires' },
  { code: '628', label: 'Autres charges diverses' },
  { code: '631', label: 'Impôts, taxes et versements assimilés' },
  { code: '651', label: 'Charges locatives' },
  // Tiers
  { code: '411', label: 'Clients — étudiants' },
  { code: '419', label: 'Clients — avoirs' },
  { code: '401', label: 'Fournisseurs' },
  { code: '409', label: 'Fournisseurs — avoirs' },
  // Trésorerie
  { code: '521', label: 'Banques' },
  { code: '571', label: 'Caisse' },
  // Immobilisations
  { code: '241', label: 'Matériel et mobilier de bureau' },
]

// ── Journal ───────────────────────────────────────────────────────────────────

function SectionJournal({ tenantId }: { tenantId: string }) {
  const [entries,  setEntries]  = useState<JournalEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [filter,   setFilter]   = useState<'tous' | 'recette' | 'depense'>('tous')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], libelle: '', type: 'recette',
    montant_ht: '', tva: '0', categorie: '701',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('journal_comptable').select('*').eq('tenant_id', tenantId)
      .order('date', { ascending: false }).limit(200)
    setEntries((data ?? []) as JournalEntry[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.libelle || !form.montant_ht) return
    setSaving(true)
    const ht  = Number(form.montant_ht)
    const tva = Number(form.tva)
    const ttc = ht * (1 + tva / 100)
    await supabase.from('journal_comptable').insert({
      tenant_id: tenantId, date: form.date, libelle: form.libelle,
      type: form.type, montant_ht: ht, tva, ca: tva, montant_ttc: ttc,
      categorie: `${form.categorie} — ${COMPTES_OHADA.find(c => c.code === form.categorie)?.label ?? ''}`,
    })
    setForm(p => ({ ...p, libelle: '', montant_ht: '', tva: '0' }))
    setShowForm(false); load(); setSaving(false)
  }

  const displayed = entries.filter(e => filter === 'tous' || e.type === filter)
  const totalRecettes = entries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ttc, 0)
  const totalDepenses = entries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ttc, 0)
  const solde         = totalRecettes - totalDepenses

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Recettes" value={fmt(totalRecettes) + ' FCFA'} color="#142850" />
        <KpiCard label="Total Dépenses" value={fmt(totalDepenses) + ' FCFA'} color="#F51E33" />
        <KpiCard label="Solde" value={fmt(Math.abs(solde)) + ' FCFA'} sub={solde >= 0 ? 'Excédent' : 'Déficit'} color={solde >= 0 ? '#142850' : '#F51E33'} />
      </div>

      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
          {([['tous', 'Tous'], ['recette', 'Recettes'], ['depense', 'Dépenses']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filter === k ? '#8B0070' : 'transparent', color: filter === k ? '#fff' : '#8B949E' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#8B0070', color: '#fff' }}>
          <Plus size={13} /> Saisir une écriture
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#8B0070]/30 p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <p className="text-xs font-bold text-[#8B0070]">Nouvelle écriture comptable OHADA</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} type="date" />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  <option value="recette">Recette</option>
                  <option value="depense">Dépense</option>
                </select>
              </div>
              <div className="col-span-2">
                <FI label="Libellé *" value={form.libelle} onChange={v => setForm(p => ({ ...p, libelle: v }))} placeholder="Description de l'opération…" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Compte OHADA</label>
                <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {COMPTES_OHADA.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                </select>
              </div>
              <FI label="TVA (%)" value={form.tva} onChange={v => setForm(p => ({ ...p, tva: v }))} type="number" placeholder="0" />
              <FI label="Montant HT (FCFA) *" value={form.montant_ht} onChange={v => setForm(p => ({ ...p, montant_ht: v }))} type="number" />
              <div className="flex items-end pb-1">
                <p className="text-sm font-bold text-[#8B0070]">
                  TTC : {fmt((Number(form.montant_ht) || 0) * (1 + (Number(form.tva) || 0) / 100))} FCFA
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.libelle || !form.montant_ht} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#8B0070', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">Aucune écriture comptable.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Date', 'Compte OHADA', 'Libellé', 'Type', 'Montant HT', 'TVA%', 'TTC'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(e => (
                <tr key={e.id} className="border-t border-white/[0.04] hover:bg-white/[0.01]">
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] font-mono">{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-mono bg-[#8B0070]/10 text-[#8B0070] px-1.5 py-0.5 rounded">
                      {e.categorie.split('—')[0]?.trim() || e.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white max-w-[200px] truncate">{e.libelle}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={e.type === 'recette' ? { color: '#142850', background: '#14285018' } : { color: '#F51E33', background: '#F51E3318' }}>
                      {e.type === 'recette' ? 'Recette' : 'Dépense'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{fmt(e.montant_ht)}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{e.tva}%</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: e.type === 'recette' ? '#142850' : '#F51E33' }}>
                    {fmt(e.montant_ttc)} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Grand Livre ───────────────────────────────────────────────────────────────

function SectionGrandLivre({ tenantId }: { tenantId: string }) {
  const [entries,  setEntries]  = useState<JournalEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    supabase.from('journal_comptable').select('*').eq('tenant_id', tenantId)
      .order('date', { ascending: true })
      .then(({ data }) => { setEntries((data ?? []) as JournalEntry[]); setLoading(false) })
  }, [tenantId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>

  const byAccount: Record<string, JournalEntry[]> = {}
  entries.forEach(e => {
    const code = e.categorie.split('—')[0]?.trim() || e.categorie
    if (!byAccount[code]) byAccount[code] = []
    byAccount[code].push(e)
  })

  const accounts = Object.entries(byAccount).map(([code, entries]) => ({
    code,
    label: COMPTES_OHADA.find(c => c.code === code.trim())?.label ?? code,
    entries,
    totalRecettes: entries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ttc, 0),
    totalDepenses: entries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ttc, 0),
    solde:         entries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ttc, 0) - entries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ttc, 0),
  })).sort((a, b) => a.code.localeCompare(b.code))

  if (accounts.length === 0) return <div className="text-center py-12 text-[var(--text-secondary)] text-xs">Aucune écriture dans le journal.</div>

  return (
    <div className="flex gap-5">
      <div className="w-56 shrink-0 rounded-xl border border-white/[0.06] overflow-hidden h-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-3 py-2 border-b border-white/[0.06]"><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Comptes</p></div>
        <div className="overflow-y-auto max-h-[520px]">
          {accounts.map(a => (
            <button key={a.code} onClick={() => setSelected(a.code)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-white/[0.04] ${selected === a.code ? 'bg-[#8B0070]/10' : 'hover:bg-white/[0.02]'}`}>
              <div>
                <p className="text-xs font-mono font-bold text-[#8B0070]">{a.code}</p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{a.label}</p>
              </div>
              <p className="text-[10px] font-bold ml-2" style={{ color: a.solde >= 0 ? '#142850' : '#F51E33' }}>
                {a.solde >= 0 ? '+' : ''}{fmt(a.solde / 1000)}k
              </p>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        (() => {
          const account = accounts.find(a => a.code === selected)!
          return (
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white font-mono">{account.code} — {account.label}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{account.entries.length} écriture(s)</p>
                </div>
                <div className="flex gap-3">
                  <KpiCard label="Débit"    value={fmt(account.totalDepenses) + ' FCFA'} color="#F51E33" />
                  <KpiCard label="Crédit"   value={fmt(account.totalRecettes) + ' FCFA'} color="#142850" />
                  <KpiCard label="Solde"    value={fmt(Math.abs(account.solde)) + ' FCFA'} color={account.solde >= 0 ? '#142850' : '#F51E33'} />
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Libellé', 'Débit', 'Crédit'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">{h}</th>)}</tr></thead>
                  <tbody>
                    {account.entries.map(e => (
                      <tr key={e.id} className="border-t border-white/[0.04]">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-2.5 text-white">{e.libelle}</td>
                        <td className="px-4 py-2.5">{e.type === 'depense' ? <span className="text-[#F51E33] font-semibold">{fmt(e.montant_ttc)}</span> : <span className="text-[var(--text-secondary)]">—</span>}</td>
                        <td className="px-4 py-2.5">{e.type === 'recette' ? <span className="text-[#F51E33] font-semibold">{fmt(e.montant_ttc)}</span> : <span className="text-[var(--text-secondary)]">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()
      ) : (
        <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
          <div className="text-center"><BookOpen size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sélectionnez un compte</p></div>
        </div>
      )}
    </div>
  )
}

// ── Bilan ─────────────────────────────────────────────────────────────────────

function SectionBilan({ tenantId }: { tenantId: string }) {
  const [entries,  setEntries]  = useState<JournalEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [annee,    setAnnee]    = useState(new Date().getFullYear())

  useEffect(() => {
    setLoading(true)
    const start = new Date(annee, 0, 1).toISOString()
    const end   = new Date(annee, 11, 31, 23, 59, 59).toISOString()
    supabase.from('journal_comptable').select('*').eq('tenant_id', tenantId)
      .gte('date', start.split('T')[0]).lte('date', end.split('T')[0])
      .then(({ data }) => { setEntries((data ?? []) as JournalEntry[]); setLoading(false) })
  }, [tenantId, annee])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>

  const recettes = entries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ttc, 0)
  const depenses = entries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ttc, 0)
  const resultat = recettes - depenses

  const byCompteR = entries.filter(e => e.type === 'recette').reduce((acc, e) => {
    const k = e.categorie.split('—')[0]?.trim() || e.categorie
    acc[k] = (acc[k] ?? 0) + e.montant_ttc; return acc
  }, {} as Record<string, number>)

  const byCompteD = entries.filter(e => e.type === 'depense').reduce((acc, e) => {
    const k = e.categorie.split('—')[0]?.trim() || e.categorie
    acc[k] = (acc[k] ?? 0) + e.montant_ttc; return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-secondary)]">Exercice :</label>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))} className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            {[2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-white/[0.08] text-[var(--text-secondary)] hover:text-white">
          <Download size={12} /> Exporter PDF
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Produits"  value={fmt(recettes) + ' FCFA'}         color="#142850" />
        <KpiCard label="Total Charges"   value={fmt(depenses) + ' FCFA'}         color="#F51E33" />
        <KpiCard label="Résultat net"     value={fmt(Math.abs(resultat)) + ' FCFA'} sub={resultat >= 0 ? 'Bénéfice' : 'Perte'} color={resultat >= 0 ? '#142850' : '#F51E33'} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#142850]/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(46,160,67,0.06)' }}>
            <p className="text-xs font-bold text-[#F51E33] uppercase tracking-wider">Produits — Comptes 7xx</p>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(byCompteR).map(([code, amount]) => {
                const label = COMPTES_OHADA.find(c => c.code === code.trim())?.label ?? code
                return (
                  <tr key={code} className="border-b border-white/[0.04]">
                    <td className="px-4 py-2.5 font-mono text-[#8B0070]">{code}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] text-[10px]">{label}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#F51E33]">{fmt(amount)} FCFA</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#142850]/30">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-[#F51E33]">TOTAL PRODUITS</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#F51E33]">{fmt(recettes)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-[#F51E33]/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(248,81,73,0.06)' }}>
            <p className="text-xs font-bold text-[#F51E33] uppercase tracking-wider">Charges — Comptes 6xx</p>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(byCompteD).map(([code, amount]) => {
                const label = COMPTES_OHADA.find(c => c.code === code.trim())?.label ?? code
                return (
                  <tr key={code} className="border-b border-white/[0.04]">
                    <td className="px-4 py-2.5 font-mono text-[#8B0070]">{code}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] text-[10px]">{label}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#F51E33]">{fmt(amount)} FCFA</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#F51E33]/30">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-[#F51E33]">TOTAL CHARGES</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#F51E33]">{fmt(depenses)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border-2 p-4 flex items-center justify-between" style={{ borderColor: resultat >= 0 ? '#142850' : '#F51E33', background: resultat >= 0 ? 'rgba(46,160,67,0.05)' : 'rgba(248,81,73,0.05)' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: resultat >= 0 ? '#142850' : '#F51E33' }}>RÉSULTAT DE L&apos;EXERCICE {annee}</p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{resultat >= 0 ? 'Bénéfice — à affecter aux réserves' : 'Perte — à couvrir'}</p>
        </div>
        <p className="text-2xl font-bold" style={{ color: resultat >= 0 ? '#142850' : '#F51E33' }}>
          {resultat >= 0 ? '+' : '-'}{fmt(Math.abs(resultat))} FCFA
        </p>
      </div>
    </div>
  )
}

// ── Trésorerie ────────────────────────────────────────────────────────────────

interface Transaction {
  id: string; type: string; montant: number; label: string | null
  description: string | null; category: string | null; source: string | null
  mode_paiement: string | null; date: string; created_at: string
}

function SectionTresorerie({ tenantId }: { tenantId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [filter,       setFilter]       = useState<'tous' | 'entree' | 'sortie'>('tous')
  const [form, setForm] = useState({
    type: 'entree', montant: '', label: '', category: '701',
    mode_paiement: 'especes', date: new Date().toISOString().split('T')[0],
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*')
      .eq('tenant_id', tenantId).order('date', { ascending: false }).limit(200)
    setTransactions((data ?? []) as Transaction[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.montant || !form.label) return
    setSaving(true)
    await supabase.from('transactions').insert({
      tenant_id:    tenantId,
      type:         form.type,
      montant:      Number(form.montant),
      label:        form.label,
      category:     form.category,
      mode_paiement:form.mode_paiement,
      date:         form.date,
      source:       'manuel',
    })
    setForm(p => ({ ...p, montant: '', label: '' }))
    setShowForm(false); setSaving(false); load()
  }

  const displayed = transactions.filter(t => filter === 'tous' || t.type === filter)
  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const solde        = totalEntrees - totalSorties

  return (
    <div className="space-y-4">
      {/* KPIs trésorerie */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Entrées',  val: totalEntrees, color: '#142850', icon: ArrowUpCircle },
          { label: 'Total Sorties',  val: totalSorties, color: '#F51E33', icon: ArrowDownCircle },
          { label: 'Solde Net',      val: solde,        color: solde >= 0 ? '#142850' : '#F51E33', icon: Wallet },
        ].map(k => (
          <div key={k.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg shrink-0" style={{ background: `${k.color}22` }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-wide">{k.label}</p>
              <p className="text-lg font-bold" style={{ color: k.color }}>{fmt(k.val)} FCFA</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barre d'actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {[
            { id: 'tous'   as const, label: 'Tout' },
            { id: 'entree' as const, label: 'Entrées' },
            { id: 'sortie' as const, label: 'Sorties' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: filter === f.id ? '#8B0070' : 'transparent', color: filter === f.id ? '#fff' : '#8B949E' }}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8B0070]/20 text-[#8B0070] text-xs hover:bg-[#8B0070]/30 transition">
          <Plus size={12} /> Nouvelle transaction
        </button>
      </div>

      {/* Formulaire */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-white/40 mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none">
                  <option value="entree">Entrée (recette)</option>
                  <option value="sortie">Sortie (dépense)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Montant (FCFA)</label>
                <input type="number" value={form.montant} onChange={e => setForm(p => ({ ...p, montant: e.target.value }))}
                  placeholder="0" className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 mb-1 block">Libellé</label>
                <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="ex: Paiement frais de scolarité — Janvier"
                  className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Compte OHADA</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none">
                  {COMPTES_OHADA.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.label.substring(0, 30)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Mode de paiement</label>
                <select value={form.mode_paiement} onChange={e => setForm(p => ({ ...p, mode_paiement: e.target.value }))}
                  className="w-full bg-[#1a2d50] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none">
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cheque">Chèque</option>
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-white/[0.04] text-white/50 text-xs hover:bg-white/[0.08] transition">Annuler</button>
                <button onClick={add} disabled={saving || !form.montant || !form.label}
                  className="flex-1 py-2 rounded-lg bg-[#8B0070] text-white text-xs font-medium hover:bg-[#8B0070] disabled:opacity-40 transition flex items-center justify-center gap-1">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Enregistrer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tableau des transactions */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-white/20" size={20} /></div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-white/20">
            <Wallet size={28} className="mb-2" />
            <p className="text-xs">Aucune transaction enregistrée.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 uppercase tracking-wider text-[10px]">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Libellé</th>
                <th className="px-4 py-2.5 text-left">Source</th>
                <th className="px-4 py-2.5 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(t => {
                const isEntree = t.type === 'entree'
                return (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-white/50">{new Date(t.date || t.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-white/80">{t.label || t.description || t.source || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        t.source === 'paiements_scolaires' ? 'bg-amber-500/10 text-[#F51E33]'
                        : t.source === 'manuel' ? 'bg-white/5 text-white/30'
                        : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {t.source === 'paiements_scolaires' ? 'Scolarité' : t.source === 'manuel' ? 'Manuel' : (t.source ?? '—')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: isEntree ? '#142850' : '#F51E33' }}>
                      {isEntree ? '+' : '-'}{fmt(t.montant)} FCFA
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Prévisions IA ─────────────────────────────────────────────────────────────

interface MonthData {
  month: string   // 'YYYY-MM'
  label: string   // 'Jan 2025'
  recettes: number
  depenses: number
  solde: number
}

function linearRegression(ys: number[]): { slope: number; intercept: number } {
  const n  = ys.length
  const xs = ys.map((_, i) => i)
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope     = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function monthLabel(yyyy: number, mm: number): string {
  const d = new Date(yyyy, mm - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

function SectionPrevisions({ tenantId }: { tenantId: string }) {
  const [data,    setData]    = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.from('journal_comptable').select('date, type, montant_ttc').eq('tenant_id', tenantId)
      .order('date', { ascending: true })
      .then(({ data: rows }) => {
        const byMonth: Record<string, { r: number; d: number }> = {}
        ;(rows ?? []).forEach(row => {
          const ym = row.date.slice(0, 7) // 'YYYY-MM'
          if (!byMonth[ym]) byMonth[ym] = { r: 0, d: 0 }
          if (row.type === 'recette') byMonth[ym].r += row.montant_ttc
          else                        byMonth[ym].d += row.montant_ttc
        })

        const keys = Object.keys(byMonth).sort()
        const hist: MonthData[] = keys.map(k => {
          const [yy, mm] = k.split('-').map(Number)
          return { month: k, label: monthLabel(yy, mm), recettes: byMonth[k].r, depenses: byMonth[k].d, solde: byMonth[k].r - byMonth[k].d }
        })

        // Project next 3 months from regression on solde
        const soldes   = hist.map(h => h.solde)
        const recettes = hist.map(h => h.recettes)
        const depenses = hist.map(h => h.depenses)
        const rReg = linearRegression(recettes)
        const dReg = linearRegression(depenses)
        const n    = hist.length

        const now   = new Date()
        const projections: MonthData[] = Array.from({ length: 3 }, (_, i) => {
          const d  = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
          const yy = d.getFullYear()
          const mm = d.getMonth() + 1
          const ym = `${yy}-${String(mm).padStart(2, '0')}`
          const r  = Math.max(0, rReg.intercept + rReg.slope * (n + i))
          const de = Math.max(0, dReg.intercept + dReg.slope * (n + i))
          return { month: ym, label: monthLabel(yy, mm), recettes: r, depenses: de, solde: r - de }
        })

        setData([...hist.slice(-6), ...projections])
        setLoading(false)
      })
  }, [tenantId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>

  const hist = data.filter((_, i) => i < data.length - 3)
  const proj = data.slice(-3)
  const avgR  = hist.length > 0 ? hist.reduce((s, h) => s + h.recettes, 0) / hist.length : 0
  const avgD  = hist.length > 0 ? hist.reduce((s, h) => s + h.depenses, 0) / hist.length : 0
  const trend = proj.length > 0 ? proj[proj.length - 1].solde : 0
  const isPositiveTrend = trend >= 0

  const maxVal = Math.max(...data.map(d => Math.max(d.recettes, d.depenses)), 1)
  const barH   = 120

  const insights: { icon: React.ElementType; color: string; text: string }[] = [
    {
      icon: avgR > avgD ? TrendingUp : TrendingDown,
      color: avgR > avgD ? '#142850' : '#F51E33',
      text: `Recettes moyennes : ${fmt(Math.round(avgR))} FCFA/mois sur les derniers mois`,
    },
    {
      icon: isPositiveTrend ? CheckCircle : AlertTriangle,
      color: isPositiveTrend ? '#142850' : '#F51E33',
      text: isPositiveTrend
        ? `Tendance favorable — solde projeté à ${fmt(Math.round(trend))} FCFA dans 3 mois`
        : `Attention — solde projeté déficitaire dans 3 mois : ${fmt(Math.round(Math.abs(trend)))} FCFA`,
    },
    {
      icon: Sparkles,
      color: '#8B0070',
      text: `Dépenses moyennes : ${fmt(Math.round(avgD))} FCFA/mois — marge nette estimée ${avgR > 0 ? ((1 - avgD / avgR) * 100).toFixed(1) : 0}%`,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header insight badge */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[#8B0070]/20" style={{ background: 'rgba(139,92,246,0.06)' }}>
        <div className="w-9 h-9 rounded-lg bg-[#8B0070]/20 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-[#8B0070]" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Prévisions IA — Trésorerie</p>
          <p className="text-xs text-[var(--text-secondary)]">Projection sur 3 mois basée sur l&apos;historique comptable (régression linéaire)</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: isPositiveTrend ? '#142850' : '#F51E33', background: isPositiveTrend ? '#14285018' : '#F51E3318' }}>
            {isPositiveTrend ? '↗ Favorable' : '↘ À surveiller'}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Historique + Prévisions (6 + 3 mois)</p>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {data.map((m, i) => {
            const isForecast = i >= data.length - 3
            const rH = Math.round((m.recettes / maxVal) * barH)
            const dH = Math.round((m.depenses / maxVal) * barH)
            return (
              <div key={m.month} className="flex flex-col items-center gap-1 min-w-[52px]" style={{ opacity: isForecast ? 0.75 : 1 }}>
                <div className="flex items-end gap-0.5" style={{ height: barH }}>
                  <div
                    className="w-4 rounded-t-sm transition-all"
                    style={{ height: rH, background: isForecast ? '#14285070' : '#142850', border: isForecast ? '1px dashed #142850' : 'none' }}
                    title={`Recettes : ${fmt(Math.round(m.recettes))} FCFA`}
                  />
                  <div
                    className="w-4 rounded-t-sm transition-all"
                    style={{ height: dH, background: isForecast ? '#F51E3370' : '#F51E33', border: isForecast ? '1px dashed #F51E33' : 'none' }}
                    title={`Dépenses : ${fmt(Math.round(m.depenses))} FCFA`}
                  />
                </div>
                <p className={`text-[9px] font-medium text-center leading-tight ${isForecast ? 'text-[#8B0070]' : 'text-[var(--text-secondary)]'}`}>
                  {isForecast && <span className="block text-[8px] text-[#8B0070]/70">prév.</span>}
                  {m.label}
                </p>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#142850]" /><span className="text-[10px] text-[var(--text-secondary)]">Recettes</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#F51E33]" /><span className="text-[10px] text-[var(--text-secondary)]">Dépenses</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-dashed border-[#8B0070] bg-[#8B0070]/20" /><span className="text-[10px] text-[var(--text-secondary)]">Prévision</span></div>
        </div>
      </div>

      {/* Projected KPIs */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Projection 3 mois</p>
        <div className="grid grid-cols-3 gap-3">
          {proj.map(m => (
            <div key={m.month} className="rounded-xl border border-[#8B0070]/20 p-4" style={{ background: 'rgba(139,92,246,0.04)' }}>
              <p className="text-[10px] font-bold text-[#8B0070] mb-2">{m.label}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Recettes</span>
                  <span className="text-[#F51E33] font-semibold">{fmt(Math.round(m.recettes))} F</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Dépenses</span>
                  <span className="text-[#F51E33] font-semibold">{fmt(Math.round(m.depenses))} F</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/[0.06] pt-1 mt-1">
                  <span className="text-white font-bold">Solde</span>
                  <span className="font-bold" style={{ color: m.solde >= 0 ? '#142850' : '#F51E33' }}>
                    {m.solde >= 0 ? '+' : ''}{fmt(Math.round(m.solde))} F
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Analyses & Recommandations</p>
        <div className="space-y-2">
          {insights.map((ins, i) => {
            const Icon = ins.icon
            return (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ins.color}18` }}>
                  <Icon size={13} style={{ color: ins.color }} />
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{ins.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">
          <Sparkles size={24} className="mx-auto mb-3 opacity-30" />
          Aucune donnée comptable pour générer des prévisions.
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComptabilitePage() {
  useRoleGuard(['DIRECTION_GENERALE', 'RAF'])
  const { tenantId, loading: tenantLoading } = useTenant()
  const [subTab,   setSubTab]   = useState<SubTab>('journal')
  const [nomEcole, setNomEcole] = useState('Mon École')

  useEffect(() => {
    if (!tenantId) return
    supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle()
      .then(({ data }) => { if (data?.nom_entreprise) setNomEcole(data.nom_entreprise) })
  }, [tenantId])

  if (tenantLoading) return (
    <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Comptabilité OHADA</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{nomEcole} · Plan comptable OHADA · Exonéré TVA éducation</p>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 rounded-lg border border-white/[0.08] text-[var(--text-secondary)] hover:text-white transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {SUB_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: subTab === t.id ? '#8B0070' : 'transparent', color: subTab === t.id ? '#fff' : '#8B949E' }}>
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {subTab === 'journal'    && tenantId && <SectionJournal    tenantId={tenantId} />}
          {subTab === 'grandlivre' && tenantId && <SectionGrandLivre tenantId={tenantId} />}
          {subTab === 'bilan'      && tenantId && <SectionBilan      tenantId={tenantId} />}
          {subTab === 'tresorerie' && tenantId && <SectionTresorerie tenantId={tenantId} />}
          {subTab === 'previsions' && tenantId && <SectionPrevisions tenantId={tenantId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
