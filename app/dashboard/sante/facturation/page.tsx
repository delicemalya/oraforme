'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, Receipt, X } from 'lucide-react'

interface Ligne { id?: string; description: string; quantite: number; prix_unitaire: number; categorie: string }
interface Facture {
  id: string; numero_facture: string; date_facture: string; montant_total: number
  montant_paye: number; remise: number; statut: string; mode_paiement: string | null; notes: string | null
  clinique_patients: { nom: string; prenom: string; numero_dossier: string; telephone: string | null } | null
  his_lignes_facture: Ligne[]
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#F59E0B', bg: '#FFFBEB' },
  partielle:  { label: 'Partielle',  color: '#2563EB', bg: '#EFF6FF' },
  payee:      { label: 'Payée',      color: '#16A34A', bg: '#F0FDF4' },
  annulee:    { label: 'Annulée',    color: '#94A3B8', bg: '#F1F5F9' },
}

const CATEGORIES = ['consultation','hospitalisation','pharmacie','labo','imagerie','bloc','autre']
const INIT_LIGNE: Ligne = { description: '', quantite: 1, prix_unitaire: 0, categorie: 'consultation' }
const INIT_FORM = { patient_id: '', notes: '', lignes: [{ ...INIT_LIGNE }] as Ligne[] }
const INIT_PAY = { montant_paye: '', mode_paiement: 'especes' }

export default function FacturationPage() {
  const [factures,  setFactures]  = useState<Facture[]>([])
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')
  const [showForm,  setShowForm]  = useState(false)
  const [showPay,   setShowPay]   = useState<string | null>(null)
  const [payFact,   setPayFact]   = useState<Facture | null>(null)
  const [form,      setForm]      = useState({ ...INIT_FORM })
  const [payForm,   setPayForm]   = useState({ ...INIT_PAY })
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [fRes, pRes] = await Promise.all([
      fetch(filter === 'all' ? '/api/sante/facturation' : `/api/sante/facturation?statut=${filter}`),
      fetch('/api/sante/patients?actif=true&limit=300'),
    ])
    if (fRes.ok) { const d = await fRes.json(); setFactures(d.factures ?? []) }
    if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function createFacture(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/facturation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  async function submitPayment(id: string) {
    setSaving(true)
    await fetch('/api/sante/facturation', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, montant_paye: Number(payForm.montant_paye), mode_paiement: payForm.mode_paiement }),
    })
    setSaving(false); setShowPay(null); setPayFact(null); setPayForm({ ...INIT_PAY }); load()
  }

  function addLigne() { setForm(p => ({ ...p, lignes: [...p.lignes, { ...INIT_LIGNE }] })) }
  function updLigne(i: number, k: keyof Ligne, v: string | number) {
    setForm(p => ({ ...p, lignes: p.lignes.map((l, j) => j === i ? { ...l, [k]: v } : l) }))
  }
  function delLigne(i: number) { setForm(p => ({ ...p, lignes: p.lignes.filter((_, j) => j !== i) })) }

  const totalForm = form.lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0)

  const stats = {
    attente:   factures.filter(f => f.statut === 'en_attente').reduce((s, f) => s + Number(f.montant_total), 0),
    partielle: factures.filter(f => f.statut === 'partielle').reduce((s, f) => s + (Number(f.montant_total) - Number(f.montant_paye)), 0),
    payee:     factures.filter(f => f.statut === 'payee').reduce((s, f) => s + Number(f.montant_paye), 0),
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#16A34A] rounded-lg flex items-center justify-center"><Receipt size={12} className="text-white" /></div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Facturation</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white rounded-xl text-[12px] font-bold hover:bg-green-800">
              <Plus size={12} /> Nouvelle facture
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4">
          {[
            { label: 'Impayées',  val: fmtNum(stats.attente),   color: '#F59E0B', count: factures.filter(f => f.statut === 'en_attente').length },
            { label: 'Partielles',val: fmtNum(stats.partielle), color: '#2563EB', count: factures.filter(f => f.statut === 'partielle').length },
            { label: 'Encaissées',val: fmtNum(stats.payee),     color: '#16A34A', count: factures.filter(f => f.statut === 'payee').length },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[16px] font-black" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[10px] text-[#94A3B8] font-bold uppercase">{s.label}</p>
              <p className="text-[11px] font-semibold text-[#475569]">{s.val} FCFA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2">
          {[['all','Toutes'],['en_attente','Impayées'],['partielle','Partielles'],['payee','Payées'],['annulee','Annulées']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${filter === k ? 'bg-[#16A34A] text-white' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['N° Facture','Patient','Date','Total','Payé','Reste','Statut','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide border-b border-[#E2E8F0]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factures.map(f => {
                    const st    = STATUTS[f.statut] ?? STATUTS.en_attente
                    const reste = Math.max(0, Number(f.montant_total) - Number(f.montant_paye))
                    const pat   = f.clinique_patients
                    return (
                      <tr key={f.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">{f.numero_facture}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0F172A]">{pat ? `${pat.prenom} ${pat.nom}` : '—'}</p>
                          {pat && <p className="text-[10px] text-[#94A3B8]">{pat.numero_dossier}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{fmtDate(f.date_facture)}</td>
                        <td className="px-4 py-3 font-black text-[#0F172A]">{fmtNum(Number(f.montant_total))} FCFA</td>
                        <td className="px-4 py-3 font-semibold text-[#16A34A]">{fmtNum(Number(f.montant_paye))} FCFA</td>
                        <td className="px-4 py-3 font-bold" style={{ color: reste > 0 ? '#DC2626' : '#16A34A' }}>
                          {reste > 0 ? `${fmtNum(reste)} FCFA` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {f.statut !== 'payee' && f.statut !== 'annulee' && (
                            <button onClick={() => { setShowPay(f.id); setPayFact(f); setPayForm({ montant_paye: String(reste), mode_paiement: 'especes' }) }}
                              className="px-2.5 py-1 bg-[#16A34A] text-white text-[10px] font-bold rounded-lg hover:bg-green-800">
                              Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {factures.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-[#94A3B8] text-[13px]">Aucune facture</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal nouvelle facture */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Nouvelle facture</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={createFacture} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                <select required value={form.patient_id} onChange={e => setForm(p => ({...p, patient_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-300">
                  <option value="">Sélectionner...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Lignes de facturation</label>
                  <button type="button" onClick={addLigne} className="text-[11px] text-green-600 font-bold">+ Ligne</button>
                </div>
                <div className="space-y-2">
                  {form.lignes.map((l, i) => (
                    <div key={i} className="bg-[#F8FAFC] rounded-xl p-2">
                      <div className="grid grid-cols-6 gap-1.5">
                        <div className="col-span-3">
                          <input value={l.description} onChange={e => updLigne(i, 'description', e.target.value)}
                            placeholder="Description" className="w-full px-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <input type="number" min={1} value={l.quantite} onChange={e => updLigne(i, 'quantite', Number(e.target.value))}
                            placeholder="Qté" className="w-full px-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <input type="number" min={0} value={l.prix_unitaire} onChange={e => updLigne(i, 'prix_unitaire', Number(e.target.value))}
                            placeholder="Prix" className="w-full px-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                        </div>
                        <button type="button" onClick={() => delLigne(i)} className="text-[#DC2626] text-[10px] font-bold">✕</button>
                      </div>
                      <select value={l.categorie} onChange={e => updLigne(i, 'categorie', e.target.value)}
                        className="mt-1 px-2 py-1 text-[10px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {totalForm > 0 && (
                  <p className="text-right text-[13px] font-black text-[#0F172A] mt-2">Total: {fmtNum(totalForm)} FCFA</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.patient_id || !form.lignes.length}
                  className="flex-1 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? 'Création...' : 'Créer facture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal encaissement */}
      {showPay && payFact && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Encaissement — {payFact.numero_facture}</h2>
              <button onClick={() => { setShowPay(null); setPayFact(null) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-3 mb-4">
              <div className="flex justify-between text-[12px]">
                <span className="text-[#64748B]">Total</span>
                <span className="font-black">{fmtNum(Number(payFact.montant_total))} FCFA</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#64748B]">Déjà payé</span>
                <span className="font-semibold text-[#16A34A]">{fmtNum(Number(payFact.montant_paye))} FCFA</span>
              </div>
              <div className="flex justify-between text-[12px] border-t border-[#E2E8F0] pt-1 mt-1">
                <span className="font-bold">Reste dû</span>
                <span className="font-black text-red-600">{fmtNum(Math.max(0, Number(payFact.montant_total) - Number(payFact.montant_paye)))} FCFA</span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Montant encaissé (FCFA) *</label>
                <input type="number" required min={1} value={payForm.montant_paye} onChange={e => setPayForm(p => ({...p, montant_paye: e.target.value}))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Mode de paiement</label>
                <select value={payForm.mode_paiement} onChange={e => setPayForm(p => ({...p, mode_paiement: e.target.value}))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="carte">Carte bancaire</option>
                  <option value="assurance">Assurance</option>
                  <option value="credit">Crédit</option>
                  <option value="mixte">Mixte</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowPay(null); setPayFact(null) }} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                <button onClick={() => submitPayment(showPay!)} disabled={saving || !payForm.montant_paye}
                  className="flex-1 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? 'Traitement...' : '✓ Encaisser'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
