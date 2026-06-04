'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Users, Download, RefreshCw, Check,
  AlertTriangle, Loader2, FileText, Eye, X,
  ChevronLeft, ChevronRight, Printer, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  calculerBulletinPaie, calculerBordereauCNSS, fmt, detailIRPP,
  type CalculSalaireResult,
} from '@/lib/fiscal/congo-calculs'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employe {
  id: string; nom: string; prenom: string; poste: string
  salaire_base: number; cnss: string; statut: string
  situation_familiale: string; nombre_enfants: number
  prime_transport: number; matricule: string
}

interface BulletinComplet {
  employe: Employe
  calcul:  CalculSalaireResult
  bulletinId?: string
  statut: 'brouillon' | 'validee' | 'payee'
}

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// ── Modal bulletin détaillé ────────────────────────────────────────────────────

function ModalBulletin({ b, mois, annee, entreprise, onClose }: {
  b: BulletinComplet; mois: number; annee: number; entreprise: string; onClose: () => void
}) {
  const { employe: e, calcul: c } = b
  const tranches = detailIRPP(c.base_irpp, c.nombre_parts)

  function imprimer() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
      >
        {/* Header modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Bulletin de Paie — {MOIS_LABELS[mois]} {annee}</p>
              <p className="text-xs text-gray-500">{e.prenom} {e.nom} · {e.poste}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={imprimer} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200 transition-colors">
              <Printer size={12} /> Imprimer
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 text-sm">
          {/* En-tête bulletin */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900 text-base">{entreprise}</p>
              <p className="text-gray-500 text-xs mt-0.5">Bulletin de paie — {MOIS_LABELS[mois]} {annee}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Matricule : <span className="font-medium text-gray-800">{e.matricule || '—'}</span></p>
              <p className="text-xs text-gray-500">N° CNSS : <span className="font-medium text-gray-800">{e.cnss || '—'}</span></p>
              <p className="text-xs text-gray-500">Situation : <span className="font-medium text-gray-800 capitalize">{e.situation_familiale || 'Célibataire'}</span> · {e.nombre_enfants || 0} enfant(s)</p>
              <p className="text-xs text-gray-500">Parts fiscales : <span className="font-medium text-gray-800">{c.nombre_parts}</span></p>
            </div>
          </div>

          {/* Gains imposables */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Gains imposables</p>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                {[
                  ['Salaire de base', e.salaire_base],
                  ['Brut imposable total', c.brut_imposable],
                ].map(([l, v]) => (
                  <tr key={l as string}>
                    <td className="py-1.5 text-gray-600">{l}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{fmt(v as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Retenues salarié */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Retenues salarié</p>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                {[
                  [`CNSS Salarié (4% / plafonné ${new Intl.NumberFormat('fr-FR').format(1_200_000)} F)`, c.cnss_salarie],
                  [`Base IRPP (Brut - CNSS)`, c.base_irpp],
                  [`IRPP (${c.nombre_parts} part${c.nombre_parts > 1 ? 's' : ''})`, c.irpp],
                  ['TOL (Taxe logement, fixe)', c.tol],
                ].map(([l, v]) => (
                  <tr key={l as string}>
                    <td className="py-1.5 text-gray-600">{l}</td>
                    <td className="py-1.5 text-right font-medium text-red-600">{fmt(v as number)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="py-1.5 font-semibold text-gray-800 px-1">Total retenues</td>
                  <td className="py-1.5 text-right font-bold text-red-700 px-1">{fmt(c.total_retenues)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Détail IRPP */}
          {tranches.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Détail IRPP par tranches</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left py-1">Tranche</th>
                    <th className="text-right py-1">Base/part</th>
                    <th className="text-right py-1">Taux</th>
                    <th className="text-right py-1">IRPP/part</th>
                    <th className="text-right py-1">Total ({c.nombre_parts} NP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tranches.map(t => (
                    <tr key={t.libelle}>
                      <td className="py-1 text-gray-600">{t.libelle}</td>
                      <td className="py-1 text-right text-gray-700">{fmt(t.base)}</td>
                      <td className="py-1 text-right text-gray-700">{(t.taux * 100).toFixed(0)}%</td>
                      <td className="py-1 text-right text-gray-700">{fmt(t.irpp_part)}</td>
                      <td className="py-1 text-right font-medium text-gray-900">{fmt(t.irpp_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Non imposable */}
          {c.prime_transport > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Éléments non imposables</p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Prime de transport</span>
                <span className="font-medium text-green-700">+ {fmt(c.prime_transport)}</span>
              </div>
            </div>
          )}

          {/* NET À PAYER */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <p className="font-bold text-amber-900 text-base">NET À PAYER</p>
            <p className="font-black text-amber-800 text-2xl">{fmt(c.net_a_payer)}</p>
          </div>

          {/* Charges patronales */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Charges patronales (info)</p>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                {[
                  ['CNSS Vieillesse (8%, plafonné 1 200 000 F)', c.cnss_patronal_8],
                  ['CNSS Autres régimes (12.28%, plafonné 600 000 F)', c.cnss_patronal_1228],
                  ['TUS CNSS (3% sur brut)', c.tus_cnss_3],
                  ['TUS Fiscale (4.5% sur brut)', c.tus_fisc_45],
                ].map(([l, v]) => (
                  <tr key={l as string}>
                    <td className="py-1.5 text-gray-600">{l}</td>
                    <td className="py-1.5 text-right font-medium text-gray-700">{fmt(v as number)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="py-1.5 font-semibold text-gray-800 px-1">Total charges patronales</td>
                  <td className="py-1.5 text-right font-bold text-gray-900 px-1">{fmt(c.total_charges_patronales)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-bold text-gray-900 px-1">Coût total employeur</td>
                  <td className="py-1.5 text-right font-black text-gray-900 px-1">{fmt(c.cout_total_employeur)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-8">Signature Employeur</p>
              <div className="border-t border-gray-300 pt-1">
                <p className="text-xs text-gray-500">{entreprise}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-8">Signature Employé</p>
              <div className="border-t border-gray-300 pt-1">
                <p className="text-xs text-gray-500">{e.prenom} {e.nom}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function SalairesPage() {
  const { tenantId, loading: tLoading, nomEntreprise } = useTenant()
  const now = new Date()
  const [mois,   setMois]   = useState(now.getMonth() + 1)
  const [annee,  setAnnee]  = useState(now.getFullYear())
  const [employes, setEmployes] = useState<Employe[]>([])
  const [bulletins, setBulletins] = useState<BulletinComplet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [selected, setSelected] = useState<BulletinComplet | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [{ data: emps }, { data: buls }] = await Promise.all([
      supabase.from('employes').select('*').eq('tenant_id', tenantId).eq('statut', 'actif').order('nom'),
      supabase.from('bulletins_paie').select('*').eq('tenant_id', tenantId)
        .eq('mois', mois).eq('annee', annee),
    ])

    const liste: BulletinComplet[] = (emps ?? []).map(e => {
      const existing = (buls ?? []).find(b => b.employe_id === e.id)
      const calcul = calculerBulletinPaie({
        salaire_base:         e.salaire_base || 0,
        prime_transport:      e.prime_transport || 0,
        situation_familiale:  (e.situation_familiale as 'celibataire' | 'marie') || 'celibataire',
        nombre_enfants:       e.nombre_enfants || 0,
      })
      return {
        employe:    e as Employe,
        calcul,
        bulletinId: existing?.id,
        statut:     (existing?.statut ?? 'brouillon') as BulletinComplet['statut'],
      }
    })

    setBulletins(liste)
    setLoading(false)
  }, [tenantId, mois, annee])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  async function genererTousBulletins() {
    if (!tenantId) return
    setSaving(true)
    let ok = 0
    for (const b of bulletins) {
      if (b.bulletinId) continue // déjà généré
      const payload = {
        tenant_id:              tenantId,
        employe_id:             b.employe.id,
        mois,
        annee,
        salaire_base:           b.calcul.brut_imposable,
        brut:                   b.calcul.brut_imposable,
        cnss_salarie:           b.calcul.cnss_salarie,
        cnss_patronal:          b.calcul.total_charges_patronales,
        irpp:                   b.calcul.irpp,
        net:                    b.calcul.net_a_payer,
        statut:                 'generee',
      }
      const { error } = await supabase.from('bulletins_paie').insert(payload)
      if (!error) ok++
      else console.error('[bulletins_paie insert]', error)
    }
    showToast(`${ok} bulletin(s) généré(s)`, ok > 0)
    await load()
    setSaving(false)
  }

  // Récapitulatifs
  const recaps = bulletins.reduce(
    (acc, b) => ({
      brut:       acc.brut + b.calcul.brut_imposable,
      cnss:       acc.cnss + b.calcul.cnss_salarie,
      irpp:       acc.irpp + b.calcul.irpp,
      transport:  acc.transport + b.calcul.prime_transport,
      net:        acc.net + b.calcul.net_a_payer,
      patronal:   acc.patronal + b.calcul.total_charges_patronales,
      cout:       acc.cout + b.calcul.cout_total_employeur,
    }),
    { brut: 0, cnss: 0, irpp: 0, transport: 0, net: 0, patronal: 0, cout: 0 }
  )

  return (
    <div className="space-y-6 pb-12">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
              toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
            {toast.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal bulletin */}
      <AnimatePresence>
        {selected && (
          <ModalBulletin
            b={selected}
            mois={mois}
            annee={annee}
            entreprise={nomEntreprise ?? 'Entreprise'}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
            <DollarSign size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Salaires & Paie</h1>
            <p className="text-xs text-[var(--text-secondary)]">Formules exactes ECAM · Congo-Brazzaville</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur mois */}
          <div className="flex items-center gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-3 py-2">
            <button onClick={() => setMois(m => m === 1 ? 12 : m - 1)} className="p-0.5 hover:bg-gray-100 rounded">
              <ChevronLeft size={14} className="text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-[var(--text)] w-20 text-center">{MOIS_LABELS[mois]}</span>
            <button onClick={() => setMois(m => m === 12 ? 1 : m + 1)} className="p-0.5 hover:bg-gray-100 rounded">
              <ChevronRight size={14} className="text-gray-500" />
            </button>
          </div>

          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] outline-none">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button onClick={load} className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>

          <button
            onClick={genererTousBulletins}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Générer tous les bulletins
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Masse salariale brute', value: recaps.brut,     color: '#F59E0B', icon: TrendingUp },
          { label: 'Total CNSS + IRPP',     value: recaps.cnss + recaps.irpp, color: '#DC2626', icon: AlertTriangle },
          { label: 'Total Net à payer',      value: recaps.net,      color: '#16A34A', icon: DollarSign },
          { label: 'Coût total employeur',   value: recaps.cout,     color: '#7C3AED', icon: Users },
        ].map(k => (
          <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.color + '20' }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">{k.label}</p>
            </div>
            <p className="text-lg font-bold text-[var(--text)]">{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-alt)] text-[var(--text-secondary)]">
                {['Employé', 'Poste', 'Brut', 'CNSS 4%', 'IRPP', 'Transport', 'Net', 'Statut', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--text-secondary)]">
                  <Loader2 size={18} className="animate-spin mx-auto" />
                </td></tr>
              ) : bulletins.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--text-secondary)]">
                  Aucun employé actif trouvé.
                </td></tr>
              ) : bulletins.map(b => (
                <tr key={b.employe.id} className="hover:bg-[var(--surface-alt)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--text)]">
                    {b.employe.prenom} {b.employe.nom}
                    {b.employe.matricule && <span className="ml-1 text-[10px] text-[var(--text-secondary)]">#{b.employe.matricule}</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{b.employe.poste || '—'}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{fmt(b.calcul.brut_imposable)}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{fmt(b.calcul.cnss_salarie)}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{fmt(b.calcul.irpp)}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">{fmt(b.calcul.prime_transport)}</td>
                  <td className="px-4 py-3 font-bold text-amber-600">{fmt(b.calcul.net_a_payer)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.statut === 'payee'   ? 'bg-green-100 text-green-700' :
                      b.statut === 'validee' ? 'bg-blue-100 text-blue-700' :
                                               'bg-gray-100 text-gray-600'
                    }`}>
                      {b.statut === 'payee' ? 'Payé' : b.statut === 'validee' ? 'Validé' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(b)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      <Eye size={11} /> Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Récapitulatif bas de page */}
        {bulletins.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-alt)]">
            <div className="flex flex-wrap gap-6 text-xs font-semibold text-[var(--text-secondary)]">
              <span>Brut total : <strong className="text-[var(--text)]">{fmt(recaps.brut)}</strong></span>
              <span>CNSS + IRPP + TOL : <strong className="text-red-600">{fmt(recaps.cnss + recaps.irpp + bulletins.length * 1000)}</strong></span>
              <span>Net total : <strong className="text-amber-600">{fmt(recaps.net)}</strong></span>
              <span>Charges patronales : <strong className="text-purple-600">{fmt(recaps.patronal)}</strong></span>
              <span>Coût employeur : <strong className="text-[var(--text)]">{fmt(recaps.cout)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
