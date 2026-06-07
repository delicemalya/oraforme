'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  AlertTriangle, CheckCircle, Clock, Send, X,
  ChevronRight, RefreshCw, Filter, Loader2,
  DollarSign, Users, TrendingDown, ShieldAlert,
  Mail, Phone, FileText, History, Plus,
  MessageSquare, Download,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Niveau = 1 | 2 | 3 | 4 | 5
type TypeRelance = 'email' | 'sms' | 'courrier' | 'appel' | 'mise_en_demeure'

interface FactureImpayee {
  id: string
  invoice_number: string | null
  client_name: string | null
  client_id: string | null
  total: number
  due_date: string | null
  date: string | null
  statut: string
  retard_jours: number
  nb_relances: number
  derniere_relance: string | null
  client_score?: number
}

interface Relance {
  id: string
  facture_id: string
  type: TypeRelance
  niveau: Niveau
  statut: string
  date_relance: string
  message?: string | null
  montant_concerne?: number | null
  retard_jours?: number | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n?: number | null) {
  if (!n) return '0 FCFA'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function retardColor(j: number) {
  if (j <= 15) return { bg: '#FEF3C7', text: '#D97706', label: 'Léger' }
  if (j <= 30) return { bg: '#FEE2E2', text: '#DC2626', label: 'Modéré' }
  if (j <= 60) return { bg: '#DC2626', text: '#FFFFFF', label: 'Important' }
  return { bg: '#7F1D1D', text: '#FFFFFF', label: 'Critique' }
}
function niveauConfig(n: Niveau) {
  const configs = {
    1: { label: '1re relance',       color: '#2563EB', icon: Mail },
    2: { label: '2e relance',         color: '#F59E0B', icon: Mail },
    3: { label: 'Relance ferme',      color: '#EA580C', icon: MessageSquare },
    4: { label: 'Mise en demeure',    color: '#DC2626', icon: AlertTriangle },
    5: { label: 'Contentieux',        color: '#7F1D1D', icon: AlertTriangle },
  }
  return configs[n] ?? configs[1]
}
function scoreColor(s?: number) {
  if (!s) return '#64748B'
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#F59E0B'
  return '#DC2626'
}

// ── Composants ────────────────────────────────────────────────────────────────

function RetardBadge({ jours }: { jours: number }) {
  const { bg, text, label } = retardColor(jours)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: bg, color: text }}>
      <Clock size={9} /> J+{jours} — {label}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RecouvrementPage() {
  const { tenant } = useTenantContext()
  const [factures, setFactures] = useState<FactureImpayee[]>([])
  const [relances, setRelances] = useState<Relance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFac, setSelectedFac] = useState<FactureImpayee | null>(null)
  const [facRelances, setFacRelances] = useState<Relance[]>([])
  const [filterNiveau, setFilterNiveau] = useState<string>('tous')
  const [showRelanceModal, setShowRelanceModal] = useState(false)
  const [relanceForm, setRelanceForm] = useState<{ type: TypeRelance; niveau: Niveau; message: string }>({
    type: 'email', niveau: 1, message: ''
  })
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const tid = tenant?.tenantId

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    // Factures impayées (envoyée ou en retard, due_date < aujourd'hui)
    const { data: raw } = await supabase
      .from('factures')
      .select('id, invoice_number, client_name, client_id, total, due_date, date, statut')
      .eq('tenant_id', tid)
      .in('statut', ['envoyee', 'retard', 'partiellement_payee'])
      .order('due_date', { ascending: true })

    const today_date = new Date(today)
    const items: FactureImpayee[] = (raw ?? [])
      .map(f => {
        const due = f.due_date ? new Date(f.due_date) : null
        const retard_jours = due ? Math.max(0, Math.ceil((today_date.getTime() - due.getTime()) / 86400000)) : 0
        return { ...f, retard_jours, nb_relances: 0, derniere_relance: null }
      })
      .filter(f => f.retard_jours > 0 || f.statut === 'envoyee')
      .sort((a, b) => b.retard_jours - a.retard_jours)

    // Charger nb relances pour chaque facture
    if (items.length > 0) {
      const ids = items.map(f => f.id)
      const { data: rels } = await supabase
        .from('relances')
        .select('id, facture_id, type, niveau, statut, date_relance, message, montant_concerne, retard_jours, created_at')
        .eq('tenant_id', tid)
        .in('facture_id', ids)
        .order('created_at', { ascending: false })

      const relsData = (rels ?? []) as Relance[]
      setRelances(relsData)

      // Enrichir avec nb relances
      items.forEach(f => {
        const fr = relsData.filter(r => r.facture_id === f.id)
        f.nb_relances = fr.length
        f.derniere_relance = fr[0]?.created_at ?? null
      })
    }

    setFactures(items)
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  function openDetail(f: FactureImpayee) {
    setSelectedFac(f)
    setFacRelances(relances.filter(r => r.facture_id === f.id))
    const niveau = Math.min(5, (f.nb_relances + 1)) as Niveau
    setRelanceForm({ type: f.nb_relances === 0 ? 'email' : f.nb_relances < 3 ? 'email' : 'courrier', niveau, message: buildMessage(f, niveau) })
  }

  function buildMessage(f: FactureImpayee, niveau: Niveau): string {
    const montant = fmt(f.total)
    const ref = f.invoice_number ?? f.id.slice(0, 8)
    if (niveau === 1) return `Madame, Monsieur,\n\nNous nous permettons de vous rappeler que la facture ${ref} d'un montant de ${montant} est arrivée à échéance.\n\nNous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,`
    if (niveau === 2) return `Madame, Monsieur,\n\nMalgré notre première relance, la facture ${ref} (${montant}) reste impayée avec un retard de ${f.retard_jours} jours.\n\nNous vous demandons de régulariser cette situation sous 8 jours.\n\nCordialement,`
    if (niveau === 3) return `Madame, Monsieur,\n\nNous constatons que la facture ${ref} (${montant}) demeure impayée. Nous vous mettons en demeure de régler cette somme dans un délai de 5 jours.\n\nFaute de règlement, nous serons contraints d'engager une procédure de recouvrement judiciaire.\n\nCordialement,`
    return `Mise en demeure formelle — Facture ${ref} — ${montant} — Retard: ${f.retard_jours} jours.`
  }

  async function sendRelance() {
    if (!tid || !selectedFac) return
    setSending(true)
    const { error } = await supabase.from('relances').insert({
      tenant_id: tid,
      facture_id: selectedFac.id,
      client_id: selectedFac.client_id,
      type: relanceForm.type,
      niveau: relanceForm.niveau,
      statut: 'envoye',
      date_relance: new Date().toISOString().split('T')[0],
      message: relanceForm.message,
      montant_concerne: selectedFac.total,
      retard_jours: selectedFac.retard_jours,
    })
    setSending(false)
    if (!error) {
      setSuccessMsg('Relance enregistrée')
      setTimeout(() => setSuccessMsg(''), 3000)
      setShowRelanceModal(false)
      load()
    }
  }

  async function marquerPayee(id: string, montant: number) {
    if (!tid || !confirm('Marquer cette facture comme payée ?')) return
    await fetch(`/api/factures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'payee', montant_paye: montant, mode_paiement: 'virement' }),
    })
    setSelectedFac(null)
    load()
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const totalImpaye = factures.reduce((s, f) => s + f.total, 0)
  const nbCritiques = factures.filter(f => f.retard_jours > 30).length
  const nbSansRelance = factures.filter(f => f.nb_relances === 0).length
  const txRecouvrement = factures.length > 0 ? Math.round((1 - factures.length / Math.max(factures.length + 1, 1)) * 100) : 100

  const filtered = filterNiveau === 'tous' ? factures
    : filterNiveau === 'sans_relance' ? factures.filter(f => f.nb_relances === 0)
    : filterNiveau === 'critiques' ? factures.filter(f => f.retard_jours > 30)
    : factures

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-100">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-[#0F172A]">Recouvrement</h1>
              <p className="text-[12px] text-[#64748B]">Relances, scoring risque client, historique</p>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total impayé', value: fmt(totalImpaye), color: '#DC2626', icon: DollarSign, sub: `${factures.length} factures` },
            { label: 'Dossiers critiques', value: nbCritiques, color: '#EA580C', icon: AlertTriangle, sub: 'Retard > 30 jours' },
            { label: 'Sans relance', value: nbSansRelance, color: '#F59E0B', icon: Send, sub: 'À relancer en priorité' },
            { label: 'Taux de recouvrement', value: `${txRecouvrement}%`, color: '#16A34A', icon: TrendingDown, sub: 'Objectif 95%' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <Icon size={14} style={{ color: k.color }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-[22px] font-black" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{k.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-[13px] font-semibold text-green-700">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex gap-2 flex-wrap">
          {[['tous', 'Toutes les factures'], ['sans_relance', `Sans relance (${nbSansRelance})`], ['critiques', `Critiques >30j (${nbCritiques})`]].map(([id, label]) => (
            <button key={id} onClick={() => setFilterNiveau(id)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${filterNiveau === id ? 'bg-red-600 text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-red-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-[#94A3B8]">
              <Loader2 size={18} className="animate-spin" /> Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#0F172A] font-bold text-[15px]">Aucune facture impayée !</p>
              <p className="text-[13px] text-[#64748B] mt-1">Tous les paiements sont à jour.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Facture','Client','Retard','Montant','Relances','Dernière action','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map(f => {
                    const { bg, text } = retardColor(f.retard_jours)
                    const urgence = f.retard_jours > 30 ? 'bg-red-50' : f.retard_jours > 15 ? 'bg-amber-50/30' : ''
                    return (
                      <tr key={f.id} className={`${urgence} hover:bg-[#FAFAF9] transition-colors`}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[13px] text-[#0F172A]">{f.invoice_number ?? '—'}</p>
                          <p className="text-[11px] text-[#94A3B8]">{fmtDate(f.date)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[13px] text-[#0F172A]">{f.client_name ?? '—'}</p>
                          {f.due_date && <p className="text-[11px] text-[#64748B]">Échéance: {fmtDate(f.due_date)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
                            style={{ background: bg, color: text }}>
                            <Clock size={9} /> J+{f.retard_jours}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-black text-[14px] text-[#DC2626]">{fmt(f.total)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {f.nb_relances === 0 ? (
                            <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                              <AlertTriangle size={10} /> Aucune
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#64748B]">
                              {f.nb_relances} relance{f.nb_relances > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#94A3B8]">
                          {f.derniere_relance ? fmtDate(f.derniere_relance) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => { openDetail(f); setShowRelanceModal(true) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-bold hover:bg-red-700 transition-colors">
                              <Send size={10} /> Relancer
                            </button>
                            <button onClick={() => openDetail(f)}
                              className="p-1.5 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFC]">
                              <History size={12} />
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

        {/* ── Statistiques synthèse ── */}
        {factures.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Répartition par tranche de retard */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                <TrendingDown size={14} className="text-red-500" /> Répartition par ancienneté
              </h3>
              {[
                { label: '0–15 jours (léger)', jmin: 0, jmax: 15, color: '#F59E0B' },
                { label: '16–30 jours (modéré)', jmin: 16, jmax: 30, color: '#EA580C' },
                { label: '31–60 jours (important)', jmin: 31, jmax: 60, color: '#DC2626' },
                { label: '> 60 jours (critique)', jmin: 61, jmax: Infinity, color: '#7F1D1D' },
              ].map(t => {
                const items = factures.filter(f => f.retard_jours >= t.jmin && f.retard_jours <= t.jmax)
                const montant = items.reduce((s, f) => s + f.total, 0)
                const pct = factures.length > 0 ? Math.round(items.length * 100 / factures.length) : 0
                return (
                  <div key={t.label} className="flex items-center gap-3 py-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-[12px] mb-0.5">
                        <span className="text-[#0F172A] font-semibold">{t.label}</span>
                        <span className="font-bold" style={{ color: t.color }}>{items.length} fac. — {fmt(montant)}</span>
                      </div>
                      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: t.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Top débiteurs */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                <Users size={14} className="text-red-500" /> Top débiteurs
              </h3>
              {Object.entries(
                factures.reduce((acc, f) => {
                  const nom = f.client_name ?? '—'
                  if (!acc[nom]) acc[nom] = { nom, total: 0, nb: 0 }
                  acc[nom].total += f.total
                  acc[nom].nb += 1
                  return acc
                }, {} as Record<string, { nom: string; total: number; nb: number }>)
              ).sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([, d]) => (
                <div key={d.nom} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{d.nom}</p>
                    <p className="text-[11px] text-[#64748B]">{d.nb} facture{d.nb > 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-black text-[14px] text-[#DC2626]">{fmt(d.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer: Historique + envoi relance ── */}
      {selectedFac && !showRelanceModal && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedFac(null)}>
          <div className="flex-1 bg-black/30" />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
              <div>
                <h2 className="font-bold text-[15px] text-[#0F172A]">{selectedFac.invoice_number ?? '—'}</h2>
                <p className="text-[12px] text-[#64748B]">{selectedFac.client_name}</p>
              </div>
              <button onClick={() => setSelectedFac(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Infos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#E2E8F0] p-3">
                  <p className="text-[11px] text-[#64748B] font-bold uppercase">Montant</p>
                  <p className="text-[18px] font-black text-red-600">{fmt(selectedFac.total)}</p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] p-3">
                  <p className="text-[11px] text-[#64748B] font-bold uppercase">Retard</p>
                  <p className="text-[18px] font-black text-[#DC2626]">J+{selectedFac.retard_jours}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => setShowRelanceModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700">
                  <Send size={13} /> Envoyer relance
                </button>
                <button onClick={() => marquerPayee(selectedFac.id, selectedFac.total)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-[13px] font-bold hover:bg-green-700">
                  <CheckCircle size={13} /> Marquer payée
                </button>
              </div>

              {/* Historique relances */}
              <div>
                <h3 className="text-[13px] font-bold text-[#0F172A] mb-2">Historique relances ({facRelances.length})</h3>
                {facRelances.length === 0 ? (
                  <p className="text-[12px] text-amber-600 font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Aucune relance envoyée pour cette facture
                  </p>
                ) : (
                  <div className="space-y-2">
                    {facRelances.map(r => {
                      const cfg = niveauConfig(r.niveau as Niveau)
                      const Icon = cfg.icon
                      return (
                        <div key={r.id} className="rounded-xl border border-[#E2E8F0] p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Icon size={12} style={{ color: cfg.color }} />
                              <span className="text-[12px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: cfg.color + '15', color: cfg.color }}>{r.type}</span>
                            </div>
                            <span className="text-[10px] text-[#94A3B8]">{fmtDate(r.date_relance)}</span>
                          </div>
                          {r.message && (
                            <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2 italic">«{r.message.split('\n')[0]}»</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-bold" style={{ color: r.statut === 'envoye' ? '#16A34A' : '#94A3B8' }}>● {r.statut}</span>
                            {r.retard_jours && <span className="text-[10px] text-[#94A3B8]">J+{r.retard_jours} au moment de l'envoi</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Envoyer relance ── */}
      {showRelanceModal && selectedFac && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-bold text-[#0F172A]">Envoyer une relance</h2>
                <p className="text-[12px] text-[#64748B]">{selectedFac.client_name} — {fmt(selectedFac.total)} — J+{selectedFac.retard_jours}</p>
              </div>
              <button onClick={() => setShowRelanceModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Canal</label>
                  <select value={relanceForm.type} onChange={e => setRelanceForm(p => ({...p, type: e.target.value as TypeRelance}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white">
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="courrier">Courrier</option>
                    <option value="appel">Appel téléphonique</option>
                    <option value="mise_en_demeure">Mise en demeure</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Niveau</label>
                  <select value={relanceForm.niveau} onChange={e => {
                    const n = Number(e.target.value) as Niveau
                    setRelanceForm(p => ({...p, niveau: n, message: buildMessage(selectedFac, n)}))
                  }} className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white">
                    <option value={1}>1 — Rappel amiable</option>
                    <option value={2}>2 — 2e relance</option>
                    <option value={3}>3 — Relance ferme</option>
                    <option value={4}>4 — Mise en demeure</option>
                    <option value={5}>5 — Contentieux</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Message</label>
                  <button onClick={() => setRelanceForm(p => ({...p, message: buildMessage(selectedFac, p.niveau)}))}
                    className="text-[10px] text-blue-600 hover:underline">← Regénérer</button>
                </div>
                <textarea value={relanceForm.message} onChange={e => setRelanceForm(p => ({...p, message: e.target.value}))}
                  rows={8} className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 resize-none font-mono" />
              </div>

              {/* Niveau badge */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                {(() => {
                  const cfg = niveauConfig(relanceForm.niveau)
                  const Icon = cfg.icon
                  return <>
                    <Icon size={14} style={{ color: cfg.color }} />
                    <span className="text-[12px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-[11px] text-[#64748B] ml-auto">Relance #{selectedFac.nb_relances + 1} pour ce client</span>
                  </>
                })()}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowRelanceModal(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button onClick={sendRelance} disabled={sending}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {sending ? <><Loader2 size={13} className="animate-spin" /> Envoi...</> : <><Send size={13} /> Enregistrer relance</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
