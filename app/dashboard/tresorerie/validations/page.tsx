'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  CheckCircle2, Plus, Search, Download, Check, X, Loader2, Eye,
  Clock, Ban, AlertCircle, User, ArrowRight, Shield, MessageSquare,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Niveau = 'RAF' | 'DG' | 'Comptable' | 'Directeur'

interface DemandePaiement {
  id: string
  tenant_id: string
  date_demande: string
  libelle: string
  montant: number
  categorie: string
  mode_paiement: string
  beneficiaire: string
  compte_source: string
  compte_source_id: string | null
  justification: string
  reference_facture: string
  urgence: 'normale' | 'urgente' | 'très_urgente'
  statut: 'en_attente' | 'validé_raf' | 'validé_dg' | 'approuvé' | 'rejeté' | 'exécuté' | 'annulé'
  validé_par_raf: string | null
  validé_par_dg: string | null
  approuvé_par: string | null
  commentaire_raf: string
  commentaire_dg: string
  commentaire_rejet: string
  created_at: string
}

const STATUT_FLOW: Record<string, { label: string; color: string; next: string | null; niveau: string }> = {
  en_attente:  { label: 'En attente',     color: 'bg-slate-50 text-slate-600 border border-slate-200',   next: 'validé_raf',  niveau: 'RAF' },
  validé_raf:  { label: 'Validé RAF',     color: 'bg-blue-50 text-blue-700 border border-blue-200',      next: 'validé_dg',   niveau: 'DG' },
  validé_dg:   { label: 'Validé DG',      color: 'bg-indigo-50 text-indigo-700 border border-indigo-200',next: 'approuvé',    niveau: 'Comptable' },
  approuvé:    { label: 'Approuvé',       color: 'bg-green-50 text-green-700 border border-green-200',   next: 'exécuté',     niveau: 'Trésorier' },
  exécuté:     { label: 'Exécuté',        color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', next: null, niveau: '' },
  rejeté:      { label: 'Rejeté',         color: 'bg-red-50 text-red-700 border border-red-200',         next: null,          niveau: '' },
  annulé:      { label: 'Annulé',         color: 'bg-slate-50 text-slate-400 border border-slate-200',   next: null,          niveau: '' },
}

const URGENCE_COLORS: Record<string, string> = {
  normale:       'bg-slate-50 text-slate-500',
  urgente:       'bg-amber-50 text-amber-700',
  très_urgente:  'bg-red-50 text-red-700',
}

const EMPTY_FORM = {
  date_demande: new Date().toISOString().slice(0, 10),
  libelle: '',
  montant: '',
  categorie: 'fournisseur',
  mode_paiement: 'virement',
  beneficiaire: '',
  compte_source: 'banque',
  justification: '',
  reference_facture: '',
  urgence: 'normale',
}

export default function ValidationsPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [rows, setRows]             = useState<DemandePaiement[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [search, setSearch]         = useState('')
  const [filterStatut, setFilterStatut] = useState('all')
  const [selected, setSelected]     = useState<DemandePaiement | null>(null)
  const [validating, setValidating] = useState<{ id: string; action: 'valider' | 'rejeter' } | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [validationSaving, setValidationSaving] = useState(false)

  const totalEnAttente = rows.filter(r => !['exécuté', 'rejeté', 'annulé'].includes(r.statut)).reduce((s, r) => s + r.montant, 0)
  const totalExécuté   = rows.filter(r => r.statut === 'exécuté').reduce((s, r) => s + r.montant, 0)
  const countUrgent    = rows.filter(r => r.urgence === 'très_urgente' && !['exécuté', 'rejeté', 'annulé'].includes(r.statut)).length

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('demandes_paiement').select('*')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      if (error?.code !== '42P01') setRows(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function saveDemande() {
    if (!tenantId || !form.montant || !form.libelle || !form.beneficiaire) return
    setSaving(true)
    try {
      const { error } = await supabase.from('demandes_paiement').insert({
        tenant_id: tenantId,
        date_demande: form.date_demande,
        libelle: form.libelle,
        montant: parseInt(form.montant),
        categorie: form.categorie,
        mode_paiement: form.mode_paiement,
        beneficiaire: form.beneficiaire,
        compte_source: form.compte_source,
        justification: form.justification,
        reference_facture: form.reference_facture,
        urgence: form.urgence,
        statut: 'en_attente',
      })
      if (error) throw error
      setForm({ ...EMPTY_FORM })
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function executeValidation(dp: DemandePaiement, action: 'valider' | 'rejeter') {
    if (!tenantId) return
    setValidationSaving(true)
    try {
      const flow = STATUT_FLOW[dp.statut]
      if (!flow) return

      if (action === 'rejeter') {
        await supabase.from('demandes_paiement').update({
          statut: 'rejeté',
          commentaire_rejet: commentaire,
        }).eq('id', dp.id)
      } else {
        const nextStatut = flow.next
        const updates: Record<string, unknown> = { statut: nextStatut }

        if (dp.statut === 'en_attente') {
          updates.validé_par_raf = 'RAF'
          updates.commentaire_raf = commentaire
        } else if (dp.statut === 'validé_raf') {
          updates.validé_par_dg = 'DG'
          updates.commentaire_dg = commentaire
        } else if (dp.statut === 'validé_dg') {
          updates.approuvé_par = 'Comptable'
        }

        await supabase.from('demandes_paiement').update(updates).eq('id', dp.id)

        // If now fully approved (exécuté), write OHADA entry
        if (nextStatut === 'exécuté') {
          const creditMap: Record<string, string> = { banque: '521000', caisse: '571000', mobile: '514000' }
          await writeComptaEntry({
            tenantId,
            date: new Date().toISOString().slice(0, 10),
            libelle: `Pmt approuvé — ${dp.libelle} — ${dp.beneficiaire}`,
            type: 'depense',
            montant: dp.montant,
            categorie: dp.categorie,
            debitAccount: '401000',
            creditAccount: creditMap[dp.compte_source] ?? '521000',
            source: 'validation',
            sourceId: dp.id,
          })
        }
      }

      setValidating(null)
      setCommentaire('')
      setSelected(null)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setValidationSaving(false)
    }
  }

  const filtered = rows.filter(r => {
    if (filterStatut !== 'all' && r.statut !== filterStatut) return false
    const q = search.toLowerCase()
    if (q && !r.libelle.toLowerCase().includes(q) && !r.beneficiaire.toLowerCase().includes(q)) return false
    return true
  })

  function exportCSV() {
    const lines = ['Date,Libellé,Bénéficiaire,Montant,Urgence,Statut,Réf Facture']
    filtered.forEach(r => {
      lines.push([r.date_demande, `"${r.libelle}"`, `"${r.beneficiaire}"`,
        r.montant, r.urgence, r.statut, r.reference_facture].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `validations_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.validations.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.validations.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 shadow-sm">
            <Plus size={14} /> {t('treso.validations.approveAll')}
          </button>
        </div>
      </div>

      {/* Workflow banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          {[
            { label: 'Demande créée', icon: MessageSquare, color: 'slate' },
            { label: 'Validation RAF', icon: User, color: 'blue' },
            { label: 'Validation DG', icon: Shield, color: 'indigo' },
            { label: 'Approbation Comptable', icon: CheckCircle2, color: 'green' },
            { label: 'Exécution Paiement', icon: Check, color: 'emerald' },
          ].map((step, i, arr) => {
            const Icon = step.icon
            const colorMap: Record<string, string> = {
              slate: 'bg-slate-100 text-slate-500', blue: 'bg-blue-100 text-blue-600',
              indigo: 'bg-indigo-100 text-indigo-600', green: 'bg-green-100 text-green-600',
              emerald: 'bg-emerald-100 text-emerald-600',
            }
            return (
              <div key={step.label} className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[step.color]}`}>
                    <Icon size={13} />
                  </div>
                  <span className="text-[10px] font-medium text-[#64748B] whitespace-nowrap">{step.label}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight size={12} className="text-[#CBD5E1]" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">Montant en circuit</div>
          <div className="text-xl font-bold text-[#0F172A]">{fmtFCFA(totalEnAttente)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">Demandes urgentes</div>
          <div className="text-xl font-bold text-red-600">{countUrgent}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-2">Total exécuté</div>
          <div className="text-xl font-bold text-green-600">{fmtFCFA(totalExécuté)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
        </div>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="all">Tous statuts</option>
          {Object.entries(STATUT_FLOW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <span className="text-sm font-semibold">{filtered.length} demande{filtered.length > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <CheckCircle2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('treso.validations.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {[t('treso.validations.colDate'), t('treso.validations.colLabel'), t('treso.validations.colMontant'), 'Urgence', 'Étape suivante', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const flow = STATUT_FLOW[r.statut]
                  const canAct = flow?.next !== null
                  return (
                    <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{new Date(r.date_demande).toLocaleDateString(intlLocale)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[#0F172A]">{r.libelle}</div>
                        <div className="text-[10px] text-[#94A3B8]">{r.beneficiaire}</div>
                        {r.reference_facture && <div className="text-[10px] text-[#94A3B8]">Réf: {r.reference_facture}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">{fmtFCFA(r.montant)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${URGENCE_COLORS[r.urgence] ?? ''}`}>
                          {r.urgence}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {flow?.next ? (
                          <span className="text-[10px] text-[#0891B2] font-medium">{flow.niveau}</span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${flow?.color ?? ''}`}>{flow?.label ?? r.statut}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canAct && (
                            <>
                              <button onClick={() => { setValidating({ id: r.id, action: 'valider' }); setSelected(r) }}
                                className="px-2 py-1 text-[10px] font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                                {t('treso.validations.approve')}
                              </button>
                              <button onClick={() => { setValidating({ id: r.id, action: 'rejeter' }); setSelected(r) }}
                                className="px-2 py-1 text-[10px] font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                                {t('treso.validations.reject')}
                              </button>
                            </>
                          )}
                          <button onClick={() => { setSelected(r); setValidating(null) }}
                            className="p-1 hover:bg-[#F1F5F9] rounded-lg">
                            <Eye size={13} className="text-[#94A3B8]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Validation action modal */}
      {selected && validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">
                {validating.action === 'valider' ? '✅ Valider la demande' : '❌ Rejeter la demande'}
              </h3>
              <button onClick={() => { setValidating(null); setSelected(null) }} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-3 space-y-1">
              <div className="text-xs font-semibold">{selected.libelle}</div>
              <div className="text-xs text-[#64748B]">{selected.beneficiaire} — <strong>{fmtFCFA(selected.montant)}</strong></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Commentaire</label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                rows={3} placeholder="Motif de la décision (optionnel)"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setValidating(null); setSelected(null) }}
                className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => executeValidation(selected, validating.action)}
                disabled={validationSaving}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 ${
                  validating.action === 'valider' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
                {validationSaving ? <Loader2 size={13} className="animate-spin" /> : (validating.action === 'valider' ? <Check size={13} /> : <X size={13} />)}
                {validating.action === 'valider' ? t('treso.validations.confirmApp') : t('treso.validations.confirmRej')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal (no action) */}
      {selected && !validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Détail de la demande</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            {[
              ['Date', new Date(selected.date_demande).toLocaleDateString(intlLocale)],
              ['Libellé', selected.libelle],
              ['Bénéficiaire', selected.beneficiaire],
              ['Montant', fmtFCFA(selected.montant)],
              ['Urgence', selected.urgence],
              ['Statut', STATUT_FLOW[selected.statut]?.label ?? selected.statut],
              ['Mode paiement', selected.mode_paiement],
              ['Réf. Facture', selected.reference_facture || '—'],
              ['Justification', selected.justification || '—'],
              ['Validé RAF', selected.validé_par_raf || '—'],
              ['Commentaire RAF', selected.commentaire_raf || '—'],
              ['Validé DG', selected.validé_par_dg || '—'],
              ['Commentaire DG', selected.commentaire_dg || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-4">
                <span className="text-[#64748B] shrink-0">{k}</span>
                <span className="text-[#0F172A] font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nouvelle demande de paiement</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Date</label>
                <input type="date" value={form.date_demande} onChange={e => setForm(f => ({ ...f, date_demande: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Montant (FCFA) *</label>
                <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Bénéficiaire *</label>
                <input value={form.beneficiaire} onChange={e => setForm(f => ({ ...f, beneficiaire: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Niveau d'urgence</label>
                <select value={form.urgence} onChange={e => setForm(f => ({ ...f, urgence: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="normale">Normale</option>
                  <option value="urgente">Urgente</option>
                  <option value="très_urgente">Très urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Mode de paiement</label>
                <select value={form.mode_paiement} onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="espece">Espèces</option>
                  <option value="mobile">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Compte source</label>
                <select value={form.compte_source} onChange={e => setForm(f => ({ ...f, compte_source: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="banque">Compte bancaire</option>
                  <option value="caisse">Caisse</option>
                  <option value="mobile">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Réf. Facture</label>
                <input value={form.reference_facture} onChange={e => setForm(f => ({ ...f, reference_facture: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Justification</label>
                <textarea value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                  rows={3} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={saveDemande} disabled={saving || !form.montant || !form.libelle || !form.beneficiaire}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Soumettre la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
