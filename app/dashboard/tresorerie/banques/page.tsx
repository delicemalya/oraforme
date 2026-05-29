'use client'

/**
 * Gestion Multi-Banques — Comptes, Chèques, Virements, Rapprochements
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  Landmark, Plus, X, Save, FileText, Send, Download,
  CheckCircle2, AlertTriangle, Clock, Ban, ChevronDown,
} from 'lucide-react'

interface CompteBancaire {
  id: string; banque: string; intitule: string
  numero_compte: string; solde: number; actif: boolean
}
interface Cheque {
  id: string; compte_bancaire_id: string | null; type: 'emis' | 'recu'
  numero: string; montant: number; beneficiaire: string | null; emetteur: string | null
  banque_tiree: string | null; date_emission: string; date_echeance: string | null
  motif: string | null; statut: 'en_attente' | 'encaisse' | 'rejete' | 'annule'
}
interface Virement {
  id: string; compte_source_id: string | null; compte_source_label: string | null
  compte_dest_label: string; montant: number; motif: string | null
  date: string; statut: 'en_attente' | 'execute' | 'rejete' | 'annule'
  reference: string | null
}

const BANQUES_CG = ['BGFI Bank','Ecobank Congo','BCI','COFICAB','LCB Bank','Banque Postale','UBA Congo','Afriland','Autre']
function today() { return new Date().toISOString().split('T')[0] }

export default function BanquesPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-US' : locale
  const [comptes,  setComptes]  = useState<CompteBancaire[]>([])
  const [cheques,  setCheques]  = useState<Cheque[]>([])
  const [virements,setVirements]= useState<Virement[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [tab,      setTab]      = useState<'comptes' | 'cheques' | 'virements'>('comptes')
  const [chequeType, setChequeType] = useState<'emis' | 'recu'>('emis')

  const [modalCompte, setModalCompte] = useState(false)
  const [modalCheque, setModalCheque] = useState(false)
  const [modalVirement, setModalVirement] = useState(false)

  const [fCompte,   setFCompte]   = useState({ banque: 'BGFI Bank', intitule: '', numero_compte: '', solde: '' })
  const [fCheque,   setFCheque]   = useState({ numero: '', montant: '', beneficiaire: '', emetteur: '', banque_tiree: 'BGFI Bank', date_emission: today(), date_echeance: '', motif: '', compte_bancaire_id: '' })
  const [fVirement, setFVirement] = useState({ compte_source_id: '', compte_dest_label: '', montant: '', motif: '', date: today(), reference: '' })

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [cR, chR, vR] = await Promise.all([
      supabase.from('comptes_bancaires').select('*').eq('tenant_id', tenantId).eq('actif', true).order('created_at').limit(200),
      supabase.from('cheques').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('virements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
    ])
    setComptes((cR.data || []) as CompteBancaire[])
    setCheques((chR.data || []) as Cheque[])
    setVirements((vR.data || []) as Virement[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function saveCompte() {
    if (!tenantId || !fCompte.intitule) return
    setSaving(true)
    const { error } = await supabase.from('comptes_bancaires').insert({
      tenant_id: tenantId, banque: fCompte.banque, intitule: fCompte.intitule,
      numero_compte: fCompte.numero_compte, solde: parseFloat(fCompte.solde) || 0,
    })
    if (error) showToast(error.message, false)
    else { showToast('Compte bancaire ajouté'); setModalCompte(false); setFCompte({ banque: 'BGFI Bank', intitule: '', numero_compte: '', solde: '' }); load() }
    setSaving(false)
  }

  async function saveCheque() {
    if (!tenantId || !fCheque.numero || !fCheque.montant) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('cheques').insert({
      tenant_id: tenantId, type: chequeType,
      numero: fCheque.numero, montant: parseFloat(fCheque.montant),
      beneficiaire: chequeType === 'emis' ? fCheque.beneficiaire || null : null,
      emetteur: chequeType === 'recu' ? fCheque.emetteur || null : null,
      banque_tiree: fCheque.banque_tiree || null,
      date_emission: fCheque.date_emission, date_echeance: fCheque.date_echeance || null,
      motif: fCheque.motif || null, compte_bancaire_id: fCheque.compte_bancaire_id || null,
      statut: 'en_attente', created_by: user?.id,
    })
    if (error) showToast(error.message, false)
    else {
      showToast(chequeType === 'emis' ? 'Chèque émis enregistré' : 'Chèque reçu enregistré')
      setModalCheque(false)
      setFCheque({ numero: '', montant: '', beneficiaire: '', emetteur: '', banque_tiree: 'BGFI Bank', date_emission: today(), date_echeance: '', motif: '', compte_bancaire_id: '' })
      load()
    }
    setSaving(false)
  }

  async function saveVirement() {
    if (!tenantId || !fVirement.compte_dest_label || !fVirement.montant) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const src = comptes.find(c => c.id === fVirement.compte_source_id)
    const { error } = await supabase.from('virements').insert({
      tenant_id: tenantId, compte_source_id: fVirement.compte_source_id || null,
      compte_source_label: src?.intitule ?? null,
      compte_dest_label: fVirement.compte_dest_label,
      montant: parseFloat(fVirement.montant), motif: fVirement.motif || null,
      date: fVirement.date, reference: fVirement.reference || null,
      statut: 'en_attente', created_by: user?.id,
    })
    if (error) showToast(error.message, false)
    else {
      showToast('Virement enregistré')
      setModalVirement(false)
      setFVirement({ compte_source_id: '', compte_dest_label: '', montant: '', motif: '', date: today(), reference: '' })
      load()
    }
    setSaving(false)
  }

  async function encaisserCheque(ch: Cheque) {
    if (!tenantId) return
    await supabase.from('cheques').update({ statut: 'encaisse', date_encaissement: today() }).eq('id', ch.id)
    if (ch.type === 'recu') {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'entree', categorie: 'Virement reçu',
        description: `Encaissement chèque n°${ch.numero}${ch.emetteur ? ' de ' + ch.emetteur : ''}`,
        montant: ch.montant, date: today(), mode_paiement: 'cheque', source: 'banque', created_by: user?.id,
      })
      await writeComptaEntry({
        tenantId, date: today(),
        libelle: `Encaissement chèque n°${ch.numero}`,
        type: 'recette', montant: ch.montant,
        categorie: 'cheque',
        debitAccount: '521000', creditAccount: '412000',
        source: 'banque',
      })
    }
    showToast(`Chèque ${fmtFCFA(ch.montant)} encaissé`); load()
  }

  async function executerVirement(v: Virement) {
    if (!tenantId) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('virements').update({ statut: 'execute' }).eq('id', v.id)
    await supabase.from('transactions').insert({
      tenant_id: tenantId, type: 'sortie', categorie: 'Charges diverses',
      description: `Virement vers ${v.compte_dest_label}${v.motif ? ' — ' + v.motif : ''}`,
      montant: v.montant, date: v.date, mode_paiement: 'virement', source: 'banque', created_by: user?.id,
    })
    await writeComptaEntry({
      tenantId, date: v.date,
      libelle: `Virement vers ${v.compte_dest_label}`,
      type: 'depense', montant: v.montant,
      categorie: 'virement',
      debitAccount: '521000', creditAccount: '521000',
      source: 'banque',
    })
    showToast('Virement exécuté'); load()
  }

  const statusIcon = (s: string) => {
    if (s === 'encaisse' || s === 'execute') return <CheckCircle2 size={12} className="text-[#16A34A]" />
    if (s === 'rejete' || s === 'annule') return <Ban size={12} className="text-[#DC2626]" />
    return <Clock size={12} className="text-[#D97706]" />
  }
  const statusColor = (s: string) =>
    s === 'encaisse' || s === 'execute' ? 'bg-[#F0FDF4] text-[#16A34A]' :
    s === 'rejete'   || s === 'annule'  ? 'bg-[#FEF2F2] text-[#DC2626]' :
    'bg-[#FFFBEB] text-[#D97706]'

  function exportCSV() {
    const data = tab === 'cheques' ? cheques.map(c => ({
      Type: c.type, Numéro: c.numero, Montant: c.montant,
      Bénéficiaire: c.beneficiaire || c.emetteur || '', Banque: c.banque_tiree || '',
      'Date émission': c.date_emission, Échéance: c.date_echeance || '', Statut: c.statut,
    })) : virements.map(v => ({
      Source: v.compte_source_label || '', Destination: v.compte_dest_label,
      Montant: v.montant, Motif: v.motif || '', Date: v.date,
      Référence: v.reference || '', Statut: v.statut,
    }))
    if (!data.length) return
    const csv = '﻿' + [Object.keys(data[0]).join(';'), ...data.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${tab}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin mr-2" />
      <span className="text-[#94A3B8] text-[13px]">{t('common.loading')}</span>
    </div>
  )

  const totalBanque = comptes.reduce((s, c) => s + c.solde, 0)
  const chequesEnAttente = cheques.filter(c => c.statut === 'en_attente')
  const virementsEnAttente = virements.filter(v => v.statut === 'en_attente')

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
            <Landmark size={22} className="text-[#0891B2]" />
            {t('treso.banques.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('treso.banques.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#64748B]">
            <Download size={11} /> CSV
          </button>
          {tab === 'comptes' && (
            <button onClick={() => setModalCompte(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0891B2] text-white rounded-lg text-[12px] font-semibold">
              <Plus size={13} /> {t('treso.banques.newAccount')}
            </button>
          )}
          {tab === 'cheques' && (
            <button onClick={() => setModalCheque(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#7C3AED] text-white rounded-lg text-[12px] font-semibold">
              <Plus size={13} /> Saisir chèque
            </button>
          )}
          {tab === 'virements' && (
            <button onClick={() => setModalVirement(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white rounded-lg text-[12px] font-semibold">
              <Plus size={13} /> Nouveau virement
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('treso.banques.kpi.total'),    value: fmtFCFA(totalBanque), color: '#0891B2' },
          { label: t('treso.banques.kpi.accounts'), value: comptes.length,       color: '#0F172A', isMoney: false },
          { label: t('treso.banques.kpi.movement'), value: chequesEnAttente.length, color: '#7C3AED', isMoney: false },
          { label: 'Virements en attente',           value: virementsEnAttente.length, color: '#D97706', isMoney: false },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[16px] font-extrabold" style={{ color: k.color }}>
              {typeof k.value === 'string' ? k.value : k.value}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0]">
        {[
          { id: 'comptes',   label: 'Comptes',   icon: Landmark },
          { id: 'cheques',   label: 'Chèques',   icon: FileText },
          { id: 'virements', label: 'Virements', icon: Send },
        ].map(tab_ => {
          const Icon = tab_.icon
          return (
            <button key={tab_.id} onClick={() => setTab(tab_.id as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold rounded-t-lg border-b-2 transition-all ${
                tab === tab_.id ? 'text-[#0891B2] border-[#0891B2]' : 'text-[#64748B] border-transparent hover:text-[#0F172A]'
              }`}>
              <Icon size={13} /> {tab_.label}
            </button>
          )
        })}
      </div>

      {/* TAB COMPTES */}
      {tab === 'comptes' && (
        comptes.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] py-16 text-center">
            <Landmark size={32} className="mx-auto mb-2 text-[#E2E8F0]" />
            <p className="text-[13px] text-[#94A3B8] mb-3">{t('treso.banques.noAccounts')}</p>
            <button onClick={() => setModalCompte(true)} className="px-4 py-2 bg-[#0891B2] text-white rounded-lg text-[12px] font-semibold">
              Ajouter un compte
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comptes.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                    <Landmark size={16} className="text-[#0891B2]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#94A3B8] bg-[#F8FAFC] px-2 py-1 rounded">{c.banque}</span>
                </div>
                <div className="text-[13px] font-extrabold text-[#0F172A]">{c.intitule}</div>
                {c.numero_compte && <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">{c.numero_compte}</div>}
                <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                  <div className={`text-[20px] font-extrabold ${c.solde < 0 ? 'text-[#DC2626]' : 'text-[#0891B2]'}`}>
                    {fmtFCFA(c.solde)}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">Solde disponible</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={async () => {
                    const newSolde = prompt(`Nouveau solde pour ${c.intitule} (FCFA):`)
                    if (newSolde !== null) {
                      await supabase.from('comptes_bancaires').update({ solde: parseFloat(newSolde) || 0 }).eq('id', c.id)
                      showToast('Solde mis à jour'); load()
                    }
                  }} className="flex-1 text-[10px] font-semibold py-1.5 bg-[#F8FAFC] rounded-lg text-[#64748B] hover:bg-[#EFF6FF]">
                    Modifier solde
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB CHEQUES */}
      {tab === 'cheques' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          {cheques.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto mb-2 text-[#E2E8F0]" />
              <p className="text-[13px] text-[#94A3B8]">Aucun chèque enregistré</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  {['Type','N° Chèque','Tiers','Banque','Montant','Échéance','Statut','Action'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cheques.map(c => (
                  <tr key={c.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${c.type === 'emis' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F0FDF4] text-[#16A34A]'}`}>
                        {c.type === 'emis' ? 'Émis' : 'Reçu'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#0F172A]">{c.numero}</td>
                    <td className="px-3 py-2.5 text-[#64748B]">{c.beneficiaire || c.emetteur || '—'}</td>
                    <td className="px-3 py-2.5 text-[#94A3B8]">{c.banque_tiree || '—'}</td>
                    <td className="px-3 py-2.5 font-extrabold text-[#0F172A]">{fmtFCFA(c.montant)}</td>
                    <td className="px-3 py-2.5 text-[#64748B]">
                      {c.date_echeance ? new Date(c.date_echeance).toLocaleDateString(intlLocale) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold w-fit ${statusColor(c.statut)}`}>
                        {statusIcon(c.statut)} {c.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.statut === 'en_attente' && c.type === 'recu' && (
                        <button onClick={() => encaisserCheque(c)}
                          className="text-[10px] px-2 py-1 bg-[#16A34A] text-white rounded font-semibold">
                          Encaisser
                        </button>
                      )}
                      {c.statut === 'en_attente' && (
                        <button onClick={async () => {
                          await supabase.from('cheques').update({ statut: 'annule' }).eq('id', c.id)
                          showToast('Chèque annulé'); load()
                        }} className="ml-1 text-[10px] px-2 py-1 bg-[#F1F5F9] text-[#64748B] rounded">
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB VIREMENTS */}
      {tab === 'virements' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          {virements.length === 0 ? (
            <div className="py-16 text-center">
              <Send size={32} className="mx-auto mb-2 text-[#E2E8F0]" />
              <p className="text-[13px] text-[#94A3B8]">Aucun virement enregistré</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  {['Date','Source','Destination','Montant','Référence','Statut','Action'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {virements.map(v => (
                  <tr key={v.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-[#64748B]">
                      {new Date(v.date).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-[#64748B]">{v.compte_source_label || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#0F172A]">{v.compte_dest_label}</td>
                    <td className="px-3 py-2.5 font-extrabold text-[#0891B2]">{fmtFCFA(v.montant)}</td>
                    <td className="px-3 py-2.5 font-mono text-[#94A3B8] text-[10px]">{v.reference || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold w-fit ${statusColor(v.statut)}`}>
                        {statusIcon(v.statut)} {v.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 flex gap-1">
                      {v.statut === 'en_attente' && (
                        <>
                          <button onClick={() => executerVirement(v)}
                            className="text-[10px] px-2 py-1 bg-[#16A34A] text-white rounded font-semibold">
                            Exécuter
                          </button>
                          <button onClick={async () => {
                            await supabase.from('virements').update({ statut: 'annule' }).eq('id', v.id)
                            showToast('Virement annulé'); load()
                          }} className="text-[10px] px-2 py-1 bg-[#F1F5F9] text-[#64748B] rounded">
                            Annuler
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Compte */}
      {modalCompte && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#0891B2]">Nouveau compte bancaire</h2>
              <button onClick={() => setModalCompte(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Banque</label>
                <select value={fCompte.banque} onChange={e => setFCompte(f => ({ ...f, banque: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  {BANQUES_CG.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              {[
                { key: 'intitule',      label: 'Intitulé du compte *',     placeholder: 'Compte courant principal' },
                { key: 'numero_compte', label: 'N° de compte (IBAN/RIB)', placeholder: 'CG123456789' },
                { key: 'solde',         label: 'Solde d\'ouverture (FCFA)', placeholder: '0', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={(fCompte as Record<string, string>)[f.key]}
                    onChange={e => setFCompte(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModalCompte(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={saveCompte} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#0891B2] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chèque */}
      {modalCheque && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#7C3AED]">Saisir un chèque</h2>
              <button onClick={() => setModalCheque(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                {(['emis', 'recu'] as const).map(item => (
                  <button key={item} onClick={() => setChequeType(item)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-bold border ${chequeType === item ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-white border-[#E2E8F0] text-[#64748B]'}`}>
                    {item === 'emis' ? 'Chèque émis ↗' : 'Chèque reçu ↙'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'numero',       label: 'N° chèque *', placeholder: '00001234' },
                  { key: 'montant',      label: 'Montant *',   placeholder: '0',      type: 'number' },
                  ...(chequeType === 'emis'
                    ? [{ key: 'beneficiaire', label: 'Bénéficiaire', placeholder: 'Nom bénéficiaire' }]
                    : [{ key: 'emetteur',     label: 'Émetteur',     placeholder: 'Nom émetteur' }]),
                  { key: 'date_emission',  label: 'Date émission', placeholder: '', type: 'date' },
                  { key: 'date_echeance',  label: 'Date échéance', placeholder: '', type: 'date' },
                  { key: 'motif',          label: 'Motif',         placeholder: 'Description' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={(fCheque as Record<string, string>)[f.key]}
                      onChange={e => setFCheque(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Banque tirée</label>
                  <select value={fCheque.banque_tiree} onChange={e => setFCheque(f => ({ ...f, banque_tiree: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    {BANQUES_CG.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Compte bancaire</label>
                  <select value={fCheque.compte_bancaire_id} onChange={e => setFCheque(f => ({ ...f, compte_bancaire_id: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                    <option value="">— Choisir —</option>
                    {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModalCheque(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={saveCheque} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#7C3AED] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Virement */}
      {modalVirement && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#0F172A]">Nouveau virement bancaire</h2>
              <button onClick={() => setModalVirement(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Compte source</label>
                <select value={fVirement.compte_source_id} onChange={e => setFVirement(f => ({ ...f, compte_source_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} ({fmtFCFA(c.solde)})</option>)}
                </select>
              </div>
              {[
                { key: 'compte_dest_label', label: 'Compte destinataire *', placeholder: 'BGFI Bank — ACME SARL' },
                { key: 'montant',           label: 'Montant (FCFA) *',      placeholder: '0', type: 'number' },
                { key: 'motif',             label: 'Motif',                  placeholder: 'Paiement fournisseur...' },
                { key: 'date',              label: 'Date',                   placeholder: '', type: 'date' },
                { key: 'reference',         label: 'Référence',             placeholder: 'VIR-001' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={(fVirement as Record<string, string>)[f.key]}
                    onChange={e => setFVirement(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModalVirement(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={saveVirement} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#0F172A] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
