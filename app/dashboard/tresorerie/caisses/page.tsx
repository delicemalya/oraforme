'use client'

/**
 * Gestion des Caisses — Dépenses, Approvisionnements, Clôture, Journal
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  Archive, Plus, X, Save, ChevronDown, ChevronRight,
  Lock, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Download,
} from 'lucide-react'

interface Caisse { id: string; nom: string; numero_compte: string; solde: number; actif: boolean }
interface CaisseOp {
  id: string; caisse_id: string; type: 'depense' | 'approvisionnement'
  montant: number; motif: string | null; beneficiaire: string | null
  reference_piece: string | null; date: string; cloture_date: string | null; created_at: string
}

const CATS_DEP = ['Fournitures','Carburant','Repas','Transport','Petit matériel','Réparations','Charges diverses','Autre']
function today() { return new Date().toISOString().split('T')[0] }

export default function CaissesPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-US' : locale
  const [caisses,      setCaisses]      = useState<Caisse[]>([])
  const [ops,          setOps]          = useState<CaisseOp[]>([])
  const [selected,     setSelected]     = useState<Caisse | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [tab,          setTab]          = useState<'ops' | 'journal' | 'cloture' | 'params'>('ops')
  const [showNewOp,    setShowNewOp]    = useState(false)
  const [showNewCaisse, setShowNewCaisse] = useState(false)
  const [opType,       setOpType]       = useState<'depense' | 'approvisionnement'>('depense')

  const [fOp, setFOp] = useState({ montant: '', motif: '', beneficiaire: '', categorie: CATS_DEP[0], reference_piece: '', date: today() })
  const [fCaisse, setFCaisse] = useState({ nom: '', numero_compte: '571' })
  const [clotureSolde, setClotureSolde] = useState('')
  const [clotureDate,  setClotureDate]  = useState(today())

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('caisses').select('*').eq('tenant_id', tenantId).order('created_at').limit(200)
    setCaisses((data || []) as Caisse[])
    setLoading(false)
  }, [tenantId])

  const loadOps = useCallback(async (caisseId: string) => {
    const { data } = await supabase.from('caisse_operations').select('*')
      .eq('caisse_id', caisseId).order('date', { ascending: false }).limit(200)
    setOps((data || []) as CaisseOp[])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selected) loadOps(selected.id) }, [selected, loadOps])

  async function createCaisse() {
    if (!tenantId || !fCaisse.nom) return
    setSaving(true)
    const { data, error } = await supabase.from('caisses').insert({
      tenant_id: tenantId, nom: fCaisse.nom, numero_compte: fCaisse.numero_compte,
    }).select('*').single()
    if (error) showToast(error.message, false)
    else { showToast('Caisse créée'); setShowNewCaisse(false); setFCaisse({ nom: '', numero_compte: '571' }); await load(); if (data) setSelected(data as Caisse) }
    setSaving(false)
  }

  async function saveOp() {
    if (!tenantId || !selected || !fOp.montant) return
    const montant = parseFloat(fOp.montant)
    if (montant <= 0) return
    if (opType === 'depense' && montant > selected.solde) { showToast('Solde insuffisant', false); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const isDepense = opType === 'depense'
    const { error } = await supabase.from('caisse_operations').insert({
      caisse_id: selected.id, tenant_id: tenantId, type: opType, montant,
      motif: fOp.motif || fOp.categorie || null, beneficiaire: fOp.beneficiaire || null,
      compte_charge: isDepense ? '658' : '521',
      compte_source: isDepense ? '571' : '521',
      reference_piece: fOp.reference_piece || null,
      date: fOp.date, created_by: user?.id,
    })
    if (error) { showToast(error.message, false) } else {
      /* Sync comptabilité */
      await writeComptaEntry({
        tenantId, date: fOp.date,
        libelle: `${isDepense ? 'Dépense caisse' : 'Appro caisse'} — ${fOp.motif || fOp.categorie}`,
        type: isDepense ? 'depense' : 'recette', montant,
        categorie: fOp.categorie || 'caisse',
        debitAccount: isDepense ? '658' : '571',
        creditAccount: isDepense ? '571' : '521',
        source: 'caisse',
      })
      showToast(isDepense ? `Dépense de ${fmtFCFA(montant)} enregistrée` : `Approvisionnement de ${fmtFCFA(montant)} enregistré`)
      setFOp({ montant: '', motif: '', beneficiaire: '', categorie: CATS_DEP[0], reference_piece: '', date: today() })
      setShowNewOp(false)
      load(); loadOps(selected.id)
    }
    setSaving(false)
  }

  async function cloturerCaisse() {
    if (!selected) return
    setSaving(true)
    const { error: errOps } = await supabase.from('caisse_operations')
      .update({ cloture_date: clotureDate })
      .eq('caisse_id', selected.id)
      .is('cloture_date', null)
      .eq('date', clotureDate)
    if (errOps) { showToast(errOps.message, false); setSaving(false); return }
    if (clotureSolde !== '') {
      const { error: errSolde } = await supabase.from('caisses').update({ solde: parseFloat(clotureSolde) }).eq('id', selected.id)
      if (errSolde) { showToast(errSolde.message, false); setSaving(false); return }
    }
    showToast(`Caisse clôturée pour le ${new Date(clotureDate).toLocaleDateString(intlLocale)}`)
    setClotureSolde(''); load(); loadOps(selected.id)
    setSaving(false)
  }

  function exportCSV() {
    if (!ops.length) return
    const rows = ops.map(o => ({
      Date: o.date, Type: o.type, Motif: o.motif || '', Bénéficiaire: o.beneficiaire || '',
      Montant: o.montant, Référence: o.reference_piece || '',
      Clôturé: o.cloture_date || 'Non',
    }))
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `caisse-${selected?.nom}-${today()}.csv`; a.click()
  }

  const selectedOps = ops.filter(o => !o.cloture_date)
  const todayOps    = ops.filter(o => o.date === today())
  const totalDep    = selectedOps.filter(o => o.type === 'depense').reduce((s, o) => s + o.montant, 0)
  const totalApp    = selectedOps.filter(o => o.type === 'approvisionnement').reduce((s, o) => s + o.montant, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-2xl text-white text-[12px] font-semibold ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Archive size={22} className="text-[#D97706]" />
            {t('treso.caisses.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('treso.caisses.subtitle')}</p>
        </div>
        <button onClick={() => setShowNewCaisse(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#D97706] text-white rounded-lg text-[12px] font-semibold">
          <Plus size={13} /> {t('treso.caisses.newCaisse')}
        </button>
      </div>

      {/* Caisse selector */}
      {caisses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-16 text-center">
          <Archive size={36} className="mx-auto mb-3 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8] mb-3">{t('treso.caisses.noCaisses')}</p>
          <button onClick={() => setShowNewCaisse(true)}
            className="px-4 py-2 bg-[#D97706] text-white rounded-lg text-[12px] font-semibold">
            Créer ma première caisse
          </button>
        </div>
      ) : (
        <>
          {/* Caisse cards */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {caisses.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={`shrink-0 rounded-xl border p-4 text-left w-48 transition-all ${
                  selected?.id === c.id
                    ? 'bg-[#D97706] border-[#D97706] text-white'
                    : 'bg-white border-[#E2E8F0] hover:bg-[#FFFBEB]'
                }`}>
                <div className="text-[10px] font-bold uppercase opacity-70 mb-1">{c.numero_compte}</div>
                <div className="text-[13px] font-extrabold">{c.nom}</div>
                <div className={`text-[16px] font-extrabold mt-2 ${selected?.id === c.id ? 'text-white' : c.solde < 50000 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                  {fmtFCFA(c.solde)}
                </div>
                {c.solde < 50000 && selected?.id !== c.id && (
                  <div className="flex items-center gap-1 text-[9px] text-[#DC2626] mt-1">
                    <AlertTriangle size={9} /> Solde faible
                  </div>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <>
              {/* KPIs today */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t('treso.caisses.kpi.total'),    value: selected.solde,   color: '#D97706', isMoney: true },
                  { label: t('treso.caisses.kpi.caisses'),  value: totalDep,         color: '#DC2626', isMoney: true },
                  { label: t('treso.caisses.kpi.movement'), value: totalApp,         color: '#16A34A', isMoney: true },
                  { label: 'Opérations aujourd\'hui',        value: todayOps.length, color: '#0891B2', isMoney: false },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
                    <div className="text-[16px] font-extrabold" style={{ color: k.color }}>
                      {k.isMoney ? fmtFCFA(k.value as number) : k.value}
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Sub tabs */}
              <div className="flex gap-1 border-b border-[#E2E8F0] pb-0">
                {[
                  { id: 'ops',     label: 'Opérations' },
                  { id: 'journal', label: 'Journal' },
                  { id: 'cloture', label: 'Clôture' },
                  { id: 'params',  label: 'Paramétrage' },
                ].map(tab_ => (
                  <button key={tab_.id} onClick={() => setTab(tab_.id as typeof tab)}
                    className={`px-4 py-2 text-[12px] font-semibold rounded-t-lg border-b-2 transition-all ${
                      tab === tab_.id ? 'text-[#D97706] border-[#D97706]' : 'text-[#64748B] border-transparent hover:text-[#0F172A]'
                    }`}>
                    {tab_.label}
                  </button>
                ))}
              </div>

              {/* TAB: OPERATIONS */}
              {tab === 'ops' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#0F172A]">Opérations en cours</span>
                    <div className="flex gap-2">
                      <button onClick={exportCSV}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#64748B]">
                        <Download size={11} /> CSV
                      </button>
                      <button onClick={() => { setOpType('depense'); setShowNewOp(true) }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#DC2626] text-white rounded-lg text-[11px] font-semibold">
                        <TrendingDown size={11} /> Dépense
                      </button>
                      <button onClick={() => { setOpType('approvisionnement'); setShowNewOp(true) }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold">
                        <TrendingUp size={11} /> Appro.
                      </button>
                    </div>
                  </div>

                  {selectedOps.length === 0 ? (
                    <div className="bg-white rounded-xl border border-[#E2E8F0] py-12 text-center">
                      <Archive size={28} className="mx-auto mb-2 text-[#E2E8F0]" />
                      <p className="text-[12px] text-[#94A3B8]">Aucune opération non clôturée</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-[#F8FAFC]">
                          <tr>
                            {['Date','Type','Motif','Bénéficiaire','Montant','Réf.'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOps.map(o => (
                            <tr key={o.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2 text-[#64748B]">
                                {new Date(o.date).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' })}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  o.type === 'depense' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F0FDF4] text-[#16A34A]'
                                }`}>
                                  {o.type === 'depense' ? 'Dépense' : 'Approvisionnement'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[#0F172A] font-medium max-w-[150px] truncate">{o.motif || '—'}</td>
                              <td className="px-3 py-2 text-[#64748B]">{o.beneficiaire || '—'}</td>
                              <td className={`px-3 py-2 font-extrabold ${o.type === 'depense' ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                                {o.type === 'depense' ? '-' : '+'}{fmtFCFA(o.montant)}
                              </td>
                              <td className="px-3 py-2 text-[#94A3B8] text-[10px]">{o.reference_piece || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: JOURNAL */}
              {tab === 'journal' && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-[#0F172A]">Journal complet — {selected.nom}</h3>
                    <span className="text-[11px] text-[#64748B]">{ops.length} entrées</span>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#F8FAFC] sticky top-0">
                        <tr>
                          {['Date','Type','Motif','Montant','Clôturé'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ops.map(o => (
                          <tr key={o.id} className={`border-t border-[#F8FAFC] ${o.cloture_date ? 'opacity-60' : ''} hover:bg-[#F8FAFC]`}>
                            <td className="px-3 py-1.5 text-[#64748B]">
                              {new Date(o.date).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                o.type === 'depense' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F0FDF4] text-[#16A34A]'
                              }`}>
                                {o.type === 'depense' ? 'D' : 'A'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-[#0F172A]">{o.motif || '—'}</td>
                            <td className={`px-3 py-1.5 font-bold ${o.type === 'depense' ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                              {o.type === 'depense' ? '-' : '+'}{fmtFCFA(o.montant)}
                            </td>
                            <td className="px-3 py-1.5">
                              {o.cloture_date
                                ? <span className="text-[#16A34A] text-[9px]">✓ {new Date(o.cloture_date).toLocaleDateString(intlLocale)}</span>
                                : <span className="text-[#94A3B8] text-[9px]">Non clôturé</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: CLOTURE */}
              {tab === 'cloture' && (
                <div className="max-w-md space-y-4">
                  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#D97706] mb-2">
                      <Lock size={14} />
                      <span className="text-[13px] font-bold">Clôture de caisse</span>
                    </div>
                    <p className="text-[11px] text-[#D97706]">
                      La clôture marque toutes les opérations de la date sélectionnée comme clôturées.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">Date de clôture</label>
                    <input type="date" value={clotureDate} onChange={e => setClotureDate(e.target.value)}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">Solde physique constaté (FCFA)</label>
                    <input type="number" value={clotureSolde} onChange={e => setClotureSolde(e.target.value)}
                      placeholder={`Solde attendu: ${fmtFCFA(selected.solde)}`}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                    <p className="text-[10px] text-[#94A3B8] mt-1">Laisser vide pour conserver le solde calculé</p>
                  </div>
                  <button onClick={cloturerCaisse} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#D97706] text-white rounded-lg text-[12px] font-bold disabled:opacity-60">
                    <Lock size={13} /> {saving ? 'Clôture…' : 'Clôturer la caisse'}
                  </button>
                </div>
              )}

              {/* TAB: PARAMS */}
              {tab === 'params' && (
                <div className="max-w-md bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
                  <h3 className="text-[13px] font-bold text-[#0F172A]">Paramétrage — {selected.nom}</h3>
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">Nom de la caisse</label>
                    <input defaultValue={selected.nom}
                      onBlur={async e => {
                        if (e.target.value !== selected.nom) {
                          const { error } = await supabase.from('caisses').update({ nom: e.target.value }).eq('id', selected.id)
                          if (error) { showToast(error.message, false); return }
                          load(); setSelected({ ...selected, nom: e.target.value })
                        }
                      }}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">N° compte OHADA</label>
                    <input defaultValue={selected.numero_compte}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#64748B] font-mono" readOnly />
                  </div>
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from('caisses').update({ actif: false }).eq('id', selected.id)
                        if (error) { showToast(error.message, false); return }
                        setSelected(null); load()
                        showToast('Caisse désactivée')
                      }}
                      className="text-[11px] text-[#DC2626] font-semibold hover:underline">
                      Désactiver cette caisse
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal nouvelle opération */}
      {showNewOp && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className={`text-[15px] font-extrabold flex items-center gap-2 ${opType === 'depense' ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                {opType === 'depense' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {opType === 'depense' ? 'Dépense caisse' : 'Approvisionnement'}
              </h2>
              <button onClick={() => setShowNewOp(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {opType === 'depense' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('common.category')}</label>
                  <select value={fOp.categorie} onChange={e => setFOp(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    {CATS_DEP.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {[
                { key: 'motif',        label: 'Motif / Description', type: 'text',   placeholder: 'Achat fournitures…' },
                { key: 'beneficiaire', label: 'Bénéficiaire',         type: 'text',   placeholder: 'Nom du bénéficiaire' },
                { key: 'montant',      label: 'Montant (FCFA) *',     type: 'number', placeholder: '0' },
                { key: 'reference_piece', label: 'N° pièce',          type: 'text',   placeholder: 'BC-001' },
                { key: 'date',         label: 'Date',                  type: 'date',   placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type} value={(fOp as Record<string, string>)[f.key]}
                    onChange={e => setFOp(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
              {opType === 'depense' && (
                <div className="text-[11px] text-[#64748B] bg-[#F8FAFC] rounded-lg px-3 py-2">
                  Solde disponible: <strong className={selected.solde < parseFloat(fOp.montant || '0') ? 'text-[#DC2626]' : 'text-[#16A34A]'}>
                    {fmtFCFA(selected.solde)}
                  </strong>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowNewOp(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={saveOp} disabled={saving}
                className={`flex items-center gap-1.5 px-5 py-2 text-white rounded-lg text-[12px] font-semibold disabled:opacity-60 ${opType === 'depense' ? 'bg-[#DC2626]' : 'bg-[#16A34A]'}`}>
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvelle caisse */}
      {showNewCaisse && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#D97706]">{t('treso.caisses.newCaisse')}</h2>
              <button onClick={() => setShowNewCaisse(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Nom de la caisse *</label>
                <input value={fCaisse.nom} onChange={e => setFCaisse(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Caisse principale, Caisse RDC…"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">N° compte OHADA</label>
                <select value={fCaisse.numero_compte} onChange={e => setFCaisse(f => ({ ...f, numero_compte: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  <option value="571">571 — Caisse siège social (FCFA)</option>
                  <option value="572">572 — Caisses succursales</option>
                  <option value="58">58 — Régies d'avances</option>
                </select>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowNewCaisse(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={createCaisse} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#D97706] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
