'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Hotel, BedDouble, Users, CalendarCheck, TrendingUp,
  Plus, Search, RefreshCw, X, AlertTriangle,
  CheckCircle2, Clock, Star, Wifi, Coffee
} from 'lucide-react'

interface Chambre {
  id: string
  numero: string
  type: string
  prix_nuit: number
  capacite: number
  statut: string
  etage: number | null
  description: string | null
}

interface Reservation {
  id: string
  chambre_id: string | null
  client_nom: string
  client_telephone: string | null
  date_arrivee: string
  date_depart: string
  nb_nuits: number
  montant_total: number
  statut: string
  nb_personnes: number
  created_at: string
}

const TYPES_CHAMBRE = ['Simple', 'Double', 'Twin', 'Suite', 'Familiale', 'Présidentielle']
const STATUTS_CHAMBRE = [
  { value: 'disponible',   label: 'Disponible',  color: '#16A34A', bg: '#F0FDF4' },
  { value: 'occupee',      label: 'Occupée',     color: '#DC2626', bg: '#FEF2F2' },
  { value: 'reservee',     label: 'Réservée',    color: '#D97706', bg: '#FFFBEB' },
  { value: 'maintenance',  label: 'Maintenance', color: '#64748B', bg: '#F1F5F9' },
]
const STATUTS_RESA = [
  { value: 'confirmee',   label: 'Confirmée',   color: '#16A34A', bg: '#F0FDF4' },
  { value: 'en_attente',  label: 'En attente',  color: '#D97706', bg: '#FFFBEB' },
  { value: 'arrivee',     label: 'Arrivée',     color: '#2563EB', bg: '#EFF6FF' },
  { value: 'depart',      label: 'Départ',      color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'annulee',     label: 'Annulée',     color: '#DC2626', bg: '#FEF2F2' },
]

const TAB = ['Chambres', 'Réservations']

const emptyC = { numero: '', type: 'Double', prix_nuit: '', capacite: '2', statut: 'disponible', etage: '', description: '' }
const emptyR = { chambre_id: '', client_nom: '', client_telephone: '', date_arrivee: '', date_depart: '', nb_personnes: '1', statut: 'confirmee' }

export default function HotelPage() {
  const { tenantId } = useTenant()
  const [tab, setTab] = useState(0)
  const [chambres, setChambres] = useState<Chambre[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cForm, setCForm] = useState(emptyC)
  const [rForm, setRForm] = useState(emptyR)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: ch }, { data: rs }] = await Promise.all([
        supabase.from('hotel_chambres').select('*').eq('tenant_id', tenantId).order('numero'),
        supabase.from('hotel_reservations').select('*').eq('tenant_id', tenantId).order('date_arrivee', { ascending: false }),
      ])
      setChambres(ch || [])
      setReservations(rs || [])
    } catch { setChambres([]); setReservations([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const calcNuits = (a: string, d: string) => {
    if (!a || !d) return 0
    return Math.max(0, Math.ceil((new Date(d).getTime() - new Date(a).getTime()) / 86400000))
  }

  const selectedChambre = chambres.find(c => c.id === rForm.chambre_id)
  const nuits = calcNuits(rForm.date_arrivee, rForm.date_depart)
  const montantTotal = selectedChambre ? nuits * selectedChambre.prix_nuit : 0

  const handleSaveChambre = async () => {
    if (!tenantId || !cForm.numero || !cForm.prix_nuit) { setError('Numéro et prix requis'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('hotel_chambres').insert({
        tenant_id: tenantId, numero: cForm.numero, type: cForm.type,
        prix_nuit: parseFloat(cForm.prix_nuit), capacite: parseInt(cForm.capacite) || 2,
        statut: cForm.statut, etage: cForm.etage ? parseInt(cForm.etage) : null,
        description: cForm.description || null,
      })
      setShowModal(false); setCForm(emptyC); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const handleSaveResa = async () => {
    if (!tenantId || !rForm.client_nom || !rForm.date_arrivee || !rForm.date_depart) {
      setError('Client et dates requis'); return
    }
    if (nuits <= 0) { setError('La date de départ doit être après l\'arrivée'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('hotel_reservations').insert({
        tenant_id: tenantId, chambre_id: rForm.chambre_id || null,
        client_nom: rForm.client_nom, client_telephone: rForm.client_telephone || null,
        date_arrivee: rForm.date_arrivee, date_depart: rForm.date_depart,
        nb_nuits: nuits, montant_total: montantTotal,
        nb_personnes: parseInt(rForm.nb_personnes) || 1, statut: rForm.statut,
      })
      if (rForm.chambre_id) {
        await supabase.from('hotel_chambres').update({ statut: 'reservee' }).eq('id', rForm.chambre_id)
      }
      setShowModal(false); setRForm(emptyR); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const handleCheckIn = async (r: Reservation) => {
    await supabase.from('hotel_reservations').update({ statut: 'arrivee' }).eq('id', r.id)
    if (r.chambre_id) await supabase.from('hotel_chambres').update({ statut: 'occupee' }).eq('id', r.chambre_id)
    load()
  }

  const handleCheckOut = async (r: Reservation) => {
    await supabase.from('hotel_reservations').update({ statut: 'depart' }).eq('id', r.id)
    if (r.chambre_id) await supabase.from('hotel_chambres').update({ statut: 'disponible' }).eq('id', r.chambre_id)
    load()
  }

  const filteredC = chambres.filter(c => !search || c.numero.includes(search) || c.type.toLowerCase().includes(search.toLowerCase()))
  const filteredR = reservations.filter(r => !search || r.client_nom.toLowerCase().includes(search.toLowerCase()))

  const disponibles = chambres.filter(c => c.statut === 'disponible').length
  const occupees = chambres.filter(c => c.statut === 'occupee').length
  const revenuMois = reservations
    .filter(r => r.created_at?.startsWith(new Date().toISOString().slice(0, 7)) && r.statut !== 'annulee')
    .reduce((s, r) => s + (r.montant_total || 0), 0)
  const txOccupation = chambres.length > 0 ? Math.round((occupees / chambres.length) * 100) : 0

  const getStatutC = (v: string) => STATUTS_CHAMBRE.find(s => s.value === v) || STATUTS_CHAMBRE[0]
  const getStatutR = (v: string) => STATUTS_RESA.find(s => s.value === v) || STATUTS_RESA[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Hotel size={20} className="text-[#F59E0B]" />
            Gestion Hôtelière
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Chambres, réservations, check-in/check-out</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 border border-[#E2E8F0] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => { setError(''); setShowModal(true) }}
            className="flex items-center gap-1.5 bg-[#F59E0B] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#D97706] shadow-sm">
            <Plus size={14} /> {tab === 0 ? 'Nouvelle chambre' : 'Nouvelle réservation'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Chambres totales', value: chambres.length, icon: BedDouble, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Disponibles', value: disponibles, icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Taux occupation', value: `${txOccupation}%`, icon: TrendingUp, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Revenu ce mois', value: fmtFCFA(revenuMois), icon: TrendingUp, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-xl font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-1 flex gap-1 w-fit">
        {TAB.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === i ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 0 ? 'Rechercher une chambre…' : 'Rechercher un client…'}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
        </div>
      </div>

      {/* Chambres */}
      {tab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            [...Array(8)].map((_, i) => <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl h-40 animate-pulse" />)
          ) : filteredC.length === 0 ? (
            <div className="col-span-4 bg-white border border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <BedDouble size={32} className="text-[#E2E8F0]" />
              <p className="text-sm text-[#64748B]">Aucune chambre — commencez par en ajouter une</p>
            </div>
          ) : filteredC.map(c => {
            const st = getStatutC(c.statut)
            return (
              <div key={c.id} className="bg-white border border-[#E2E8F0] rounded-2xl p-4 hover:border-[#F59E0B]/40 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">Chambre {c.numero}</p>
                    <p className="text-xs text-[#64748B]">{c.type}{c.etage != null ? ` · Étage ${c.etage}` : ''}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#64748B] mb-3">
                  <span className="flex items-center gap-1"><Users size={11} />{c.capacite} pers.</span>
                  <span className="flex items-center gap-1"><Wifi size={11} />WiFi</span>
                  <span className="flex items-center gap-1"><Coffee size={11} />Petit-dej</span>
                </div>
                <p className="text-base font-bold text-[#F59E0B]">{fmtFCFA(c.prix_nuit)}<span className="text-[10px] text-[#94A3B8] font-normal">/nuit</span></p>
              </div>
            )
          })}
        </div>
      )}

      {/* Réservations */}
      {tab === 1 && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">Chargement…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    {['Client','Chambre','Arrivée','Départ','Nuits','Montant','Statut','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredR.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-sm text-[#64748B]">Aucune réservation</td></tr>
                  ) : filteredR.map(r => {
                    const ch = chambres.find(c => c.id === r.chambre_id)
                    const st = getStatutR(r.statut)
                    return (
                      <tr key={r.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-[#0F172A]">{r.client_nom}</p>
                          <p className="text-[10px] text-[#94A3B8]">{r.client_telephone || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#374151]">{ch ? `Ch. ${ch.numero}` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-[#374151]">{r.date_arrivee ? new Date(r.date_arrivee).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-xs text-[#374151]">{r.date_depart ? new Date(r.date_depart).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-[#374151]">{r.nb_nuits}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(r.montant_total)}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {r.statut === 'confirmee' && (
                              <button onClick={() => handleCheckIn(r)}
                                className="text-[11px] text-[#2563EB] border border-[#BFDBFE] px-2 py-0.5 rounded-lg hover:bg-[#EFF6FF]">Check-in</button>
                            )}
                            {r.statut === 'arrivee' && (
                              <button onClick={() => handleCheckOut(r)}
                                className="text-[11px] text-[#16A34A] border border-[#BBF7D0] px-2 py-0.5 rounded-lg hover:bg-[#F0FDF4]">Check-out</button>
                            )}
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
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9] sticky top-0 bg-white">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Hotel size={15} className="text-[#F59E0B]" />
                {tab === 0 ? 'Nouvelle chambre' : 'Nouvelle réservation'}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

              {tab === 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Numéro *</label>
                      <input value={cForm.numero} onChange={e => setCForm(f => ({ ...f, numero: e.target.value }))} placeholder="101"
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Type *</label>
                      <select value={cForm.type} onChange={e => setCForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
                        {TYPES_CHAMBRE.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Prix / nuit (FCFA) *</label>
                      <input type="number" value={cForm.prix_nuit} onChange={e => setCForm(f => ({ ...f, prix_nuit: e.target.value }))} placeholder="50000"
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Capacité (pers.)</label>
                      <input type="number" min="1" value={cForm.capacite} onChange={e => setCForm(f => ({ ...f, capacite: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Étage</label>
                      <input type="number" value={cForm.etage} onChange={e => setCForm(f => ({ ...f, etage: e.target.value }))} placeholder="1"
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Statut</label>
                      <select value={cForm.statut} onChange={e => setCForm(f => ({ ...f, statut: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
                        {STATUTS_CHAMBRE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Description</label>
                    <textarea value={cForm.description} onChange={e => setCForm(f => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Vue mer, balcon, jacuzzi…"
                      className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none resize-none" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Nom du client *</label>
                    <input value={rForm.client_nom} onChange={e => setRForm(f => ({ ...f, client_nom: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Téléphone</label>
                      <input value={rForm.client_telephone} onChange={e => setRForm(f => ({ ...f, client_telephone: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Nb personnes</label>
                      <input type="number" min="1" value={rForm.nb_personnes} onChange={e => setRForm(f => ({ ...f, nb_personnes: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Arrivée *</label>
                      <input type="date" value={rForm.date_arrivee} onChange={e => setRForm(f => ({ ...f, date_arrivee: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Départ *</label>
                      <input type="date" value={rForm.date_depart} onChange={e => setRForm(f => ({ ...f, date_depart: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Chambre</label>
                    <select value={rForm.chambre_id} onChange={e => setRForm(f => ({ ...f, chambre_id: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
                      <option value="">Sans chambre attribuée</option>
                      {chambres.filter(c => c.statut === 'disponible').map(c => (
                        <option key={c.id} value={c.id}>Chambre {c.numero} — {c.type} — {fmtFCFA(c.prix_nuit)}/nuit</option>
                      ))}
                    </select>
                  </div>
                  {nuits > 0 && montantTotal > 0 && (
                    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2 text-xs font-semibold text-[#D97706]">
                      ✓ {nuits} nuit(s) × {fmtFCFA(selectedChambre?.prix_nuit || 0)} = <strong>{fmtFCFA(montantTotal)}</strong>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">Annuler</button>
              <button onClick={tab === 0 ? handleSaveChambre : handleSaveResa} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#F59E0B] text-white rounded-xl hover:bg-[#D97706] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
