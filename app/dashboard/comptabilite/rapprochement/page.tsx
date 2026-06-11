'use client'

/**
 * Rapprochement Bancaire OHADA
 * Comparaison relevé bancaire vs journal comptable (compte 521000)
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { Landmark, Plus, Upload, Download, CheckCircle2, AlertTriangle, X, Save } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface Movement {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string; montant: number; source: string
}

interface LigneReleve {
  id: string; tenant_id?: string; compte: string; date_operation: string
  libelle: string; debit: number; credit: number; rapproche: boolean
  movement_id: string | null
}

interface RapprochementState {
  solde_banque: number; solde_comptable: number; ecart: number
  lignes_non_rappro: number
}

const BANK_ACCOUNTS = ['521', '512', '531', '54']  // Banques + Chèques + CCP + Mobile Money
const YEARS  = [2024, 2025, 2026, 2027]
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function RapprochementPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [movements, setMovements]   = useState<Movement[]>([])
  const [releve, setReleve]         = useState<LigneReleve[]>([])
  const [loading, setLoading]       = useState(true)
  const [year, setYear]             = useState(new Date().getFullYear())
  const [mois, setMois]             = useState(new Date().getMonth() + 1)
  const [compte, setCompte]         = useState('521')
  const [soldeBanque, setSoldeBanque] = useState<number>(0)
  const [modalAdd, setModalAdd]     = useState(false)
  const [newLigne, setNewLigne]     = useState<Partial<LigneReleve>>({})
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [mvR, rlR] = await Promise.all([
        supabase.from('journal_entries')
          .select('id, date_operation, libelle, debit_account, credit_account, montant, source')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', year)
          .order('date_operation').limit(200),
        supabase.from('rapprochement_bancaire')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('compte', compte)
          .order('date_operation').limit(200),
      ])
      setMovements((mvR.data || []) as Movement[])
      if (rlR.error?.code !== '42P01') setReleve((rlR.data || []) as LigneReleve[])
      setLoading(false)
    })()
  }, [tenantId, year, compte])

  /* Filter by month */
  const mvsMois = useMemo(() => {
    return movements.filter(m => {
      const d = new Date(m.date_operation)
      return d.getFullYear() === year && d.getMonth() + 1 === mois &&
        (m.debit_account === compte || m.credit_account === compte)
    })
  }, [movements, year, mois, compte])

  const releveMois = useMemo(() => {
    return releve.filter(r => {
      const d = new Date(r.date_operation)
      return d.getFullYear() === year && d.getMonth() + 1 === mois
    })
  }, [releve, year, mois])

  /* Solde comptable du compte banque */
  const soldeComptable = useMemo(() => {
    const allCpteMvs = movements.filter(m => {
      const d = new Date(m.date_operation)
      return (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 <= mois)) &&
        (m.debit_account === compte || m.credit_account === compte)
    })
    const td = allCpteMvs.reduce((s, m) => s + (m.debit_account === compte ? m.montant : 0), 0)
    const tc = allCpteMvs.reduce((s, m) => s + (m.credit_account === compte ? m.montant : 0), 0)
    return td - tc
  }, [movements, year, mois, compte])

  const ecart = soldeBanque - soldeComptable

  /* Lignes non rapprochées */
  const mvNonRapproIDs = new Set(releveMois.filter(r => r.rapproche && r.movement_id).map(r => r.movement_id!))
  const mvNonRappro = mvsMois.filter(m => !mvNonRapproIDs.has(m.id))

  async function toggleRapprochement(mv: Movement) {
    if (!tenantId) return
    const existing = releveMois.find(r => r.movement_id === mv.id)
    if (existing) {
      await supabase.from('rapprochement_bancaire')
        .update({ rapproche: !existing.rapproche })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
    } else {
      await supabase.from('rapprochement_bancaire').insert({
        tenant_id: tenantId, compte,
        date_operation: mv.date_operation,
        libelle: mv.libelle,
        debit: mv.debit_account === compte ? mv.montant : 0,
        credit: mv.credit_account === compte ? mv.montant : 0,
        rapproche: true, movement_id: mv.id,
      })
    }
    const { data } = await supabase.from('rapprochement_bancaire')
      .select('*').eq('tenant_id', tenantId).eq('compte', compte).order('date_operation').limit(200)
    setReleve((data || []) as LigneReleve[])
  }

  async function saveLigneManuelle() {
    if (!tenantId || !newLigne.libelle) return
    setSaving(true)
    await supabase.from('rapprochement_bancaire').insert({
      ...newLigne, tenant_id: tenantId, compte, rapproche: false, movement_id: null,
    })
    setSaving(false); setModalAdd(false); setNewLigne({})
    const { data } = await supabase.from('rapprochement_bancaire')
      .select('*').eq('tenant_id', tenantId).eq('compte', compte).order('date_operation').limit(200)
    setReleve((data || []) as LigneReleve[])
  }

  function exportCSV() {
    const rows = mvsMois.map(m => ({
      Date: m.date_operation, Libellé: m.libelle,
      Débit: m.debit_account === compte ? m.montant : 0,
      Crédit: m.credit_account === compte ? m.montant : 0,
      Rapproché: mvNonRapproIDs.has(m.id) ? 'Oui' : 'Non',
      Source: m.source,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `rapprochement-${compte}-${year}-${mois}.csv`; a.click()
  }

  const isBalanced = Math.abs(ecart) < 1

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Landmark size={22} className="text-[#2563EB]" />
            {t('compta.rapproch.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.rapproch.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={compte} onChange={e => setCompte(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {BANK_ACCOUNTS.map(ac => <option key={ac} value={ac}>{ac}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={mois} onChange={e => setMois(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
            {MONTHS_FR.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> {t('common.export')} CSV
          </button>
          <button onClick={() => setModalAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold">
            <Plus size={13} /> Ligne manuelle
          </button>
        </div>
      </div>

      {/* Solde banque input + statut */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <label className="block text-[11px] font-bold text-[#64748B] mb-1">Solde extrait bancaire (FCFA)</label>
          <input type="number" value={soldeBanque}
            onChange={e => setSoldeBanque(Number(e.target.value))}
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
          <p className="text-[10px] text-[#94A3B8] mt-1">Entrez le solde du relevé bancaire reçu</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="text-[11px] font-bold text-[#64748B] mb-1">{t('compta.rapproch.soldeCompta')} {compte}</div>
          <div className="text-[22px] font-extrabold text-[#0F172A]">{fmtFCFA(soldeComptable)}</div>
          <div className="text-[10px] text-[#94A3B8] mt-1">D'après journal_entries au {MONTHS_FR[mois-1]}</div>
        </div>
        <div className={`rounded-xl border p-4 ${
          isBalanced
            ? 'bg-[#F0FDF4] border-[#86EFAC]'
            : 'bg-[#FEF2F2] border-[#FECACA]'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isBalanced ? <CheckCircle2 size={14} className="text-[#16A34A]" /> : <AlertTriangle size={14} className="text-[#DC2626]" />}
            <span className={`text-[11px] font-bold ${isBalanced ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {isBalanced ? t('compta.rapproch.ok') : t('compta.rapproch.ecart')}
            </span>
          </div>
          <div className={`text-[22px] font-extrabold ${isBalanced ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {isBalanced ? '0 FCFA' : fmtFCFA(Math.abs(ecart))}
          </div>
          <div className="text-[10px] mt-1" style={{ color: isBalanced ? '#16A34A' : '#DC2626' }}>
            {isBalanced ? 'Soldes identiques' : ecart > 0 ? 'Banque > Comptabilité' : 'Comptabilité > Banque'}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mouvements total',     value: mvsMois.length,        isMoney: false, color: '#0F172A' },
          { label: 'Non rapprochés',       value: mvNonRappro.length,    isMoney: false, color: mvNonRappro.length > 0 ? '#DC2626' : '#16A34A' },
          { label: 'Total débits',         value: mvsMois.reduce((s,m) => s + (m.debit_account === compte ? m.montant : 0), 0), isMoney: true, color: '#2563EB' },
          { label: 'Total crédits',        value: mvsMois.reduce((s,m) => s + (m.credit_account === compte ? m.montant : 0), 0), isMoney: true, color: '#16A34A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[18px] font-extrabold" style={{ color: k.color }}>
              {k.isMoney ? fmtFCFA(k.value as number) : k.value}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table rapprochement */}
      {mvsMois.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-16 text-center">
          <Landmark size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">{t('compta.rapproch.empty')} {compte} — {MONTHS_FR[mois-1]}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <h2 className="text-[13px] font-extrabold text-[#0F172A]">
              Mouvements {compte} — {MONTHS_FR[mois-1]} {year}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{t('common.date')}</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">Libellé</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#94A3B8] uppercase">Débit</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#94A3B8] uppercase">Crédit</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#94A3B8] uppercase">Source</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#94A3B8] uppercase">Rapproché</th>
                </tr>
              </thead>
              <tbody>
                {mvsMois.map(m => {
                  const isRappro = mvNonRapproIDs.has(m.id)
                  return (
                    <tr key={m.id} className={`border-t border-[#F1F5F9] ${isRappro ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'}`}>
                      <td className="px-3 py-2 text-[#64748B] whitespace-nowrap">
                        {new Date(m.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#0F172A] max-w-[200px] truncate">{m.libelle}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#2563EB]">
                        {m.debit_account === compte ? fmtFCFA(m.montant) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[#16A34A]">
                        {m.credit_account === compte ? fmtFCFA(m.montant) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-semibold uppercase">
                          {m.source || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleRapprochement(m)}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all ${
                            isRappro
                              ? 'bg-[#16A34A] border-[#16A34A] text-white'
                              : 'bg-white border-[#E2E8F0] hover:border-[#16A34A]'
                          }`}>
                          {isRappro && <CheckCircle2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lignes manuelles du relevé */}
      {releveMois.filter(r => !r.movement_id).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#FEF3C7]">
            <h2 className="text-[13px] font-extrabold text-[#D97706]">Opérations bancaires non comptabilisées</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Date','Libellé','Débit banque','Crédit banque','Action'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {releveMois.filter(r => !r.movement_id).map(r => (
                  <tr key={r.id} className="border-t border-[#F1F5F9] hover:bg-[#FEF9F0]">
                    <td className="px-3 py-2 text-[#64748B]">
                      {new Date(r.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#0F172A]">{r.libelle}</td>
                    <td className="px-3 py-2 text-right font-bold text-[#2563EB]">{r.debit > 0 ? fmtFCFA(r.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-[#16A34A]">{r.credit > 0 ? fmtFCFA(r.credit) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] text-[#D97706] font-bold">⚠ À comptabiliser</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ligne manuelle */}
      {modalAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#0F172A]">Ligne manuelle relevé</h2>
              <button onClick={() => setModalAdd(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'date_operation', label: 'Date', type: 'date' },
                { key: 'libelle', label: 'Libellé', type: 'text' },
                { key: 'debit', label: 'Débit (entrée banque)', type: 'number' },
                { key: 'credit', label: 'Crédit (sortie banque)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type}
                    value={(newLigne as Record<string, unknown>)[f.key] as string || ''}
                    onChange={e => setNewLigne(prev => ({
                      ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                    }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModalAdd(false)}
                className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">
                {t('common.cancel')}
              </button>
              <button onClick={saveLigneManuelle} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
