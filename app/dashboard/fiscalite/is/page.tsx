'use client'

/**
 * Impôt sur les Sociétés (IS) — Congo-Brazzaville
 * Taux normal 30% · Minimum forfaitaire 1% du CA HT (plancher 500 000 FCFA)
 * Acomptes provisionnels : 3 versements (avr / jul / oct) à 25% chacun
 * Comptes SYSCOHADA : 891 IS de l'exercice / 444 IS à payer
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  TrendingUp, Download, Info, CheckCircle2, Clock, AlertTriangle, Plus, X,
} from 'lucide-react'

const TAUX_IS        = 0.30
const TAUX_MIN_CA    = 0.01
const PLANCHER_IS    = 500_000
const TAUX_ACOMPTE   = 0.25

interface Acompte {
  id:        string
  annee:     number
  trimestre: number
  base:      number
  montant:   number
  statut:    'a_verser' | 'verse' | 'exonere'
  date_versement?: string
  reference?: string
  notes?: string
  created_at: string
}

interface ISData {
  ca_ht:          number
  resultat_brut:  number
  deductions:     number
  charges_non_ded: number
}

const ANNEES = [2023, 2024, 2025, 2026]

const MOIS_ACOMPTE: Record<number, string> = {
  1: 'Avril (Q1)',
  2: 'Juillet (Q2)',
  3: 'Octobre (Q3)',
  4: 'Solde de liquidation (avr. n+1)',
}

export default function ISPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [annee,     setAnnee]     = useState(new Date().getFullYear())
  const [isData,    setIsData]    = useState<ISData>({ ca_ht: 0, resultat_brut: 0, deductions: 0, charges_non_ded: 0 })
  const [acomptes,  setAcomptes]  = useState<Acompte[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saveOk,    setSaveOk]    = useState(false)

  /* Formulaire acompte */
  const [fTrim,  setFTrim]  = useState<1|2|3|4>(1)
  const [fBase,  setFBase]  = useState('')
  const [fMont,  setFMont]  = useState('')
  const [fDate,  setFDate]  = useState(new Date().toISOString().slice(0, 10))
  const [fRef,   setFRef]   = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fStatut,setFStatut]= useState<'verse'|'a_verser'>('verse')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [jeRes, acRes] = await Promise.all([
        supabase.from('journal_entries')
          .select('debit_account, credit_account, montant')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', annee),
        supabase.from('is_acomptes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('annee', annee)
          .order('trimestre'),
      ])

      /* Calcul CA HT et résultat à partir des écritures */
      const mvts = jeRes.data ?? []
      let caHt = 0, charges = 0
      for (const mv of mvts) {
        if (mv.credit_account?.startsWith('70') || mv.credit_account?.startsWith('71')) {
          caHt += mv.montant
        }
        if (mv.debit_account?.startsWith('6')) charges += mv.montant
      }
      setIsData({ ca_ht: caHt, resultat_brut: caHt - charges, deductions: 0, charges_non_ded: 0 })
      setAcomptes((acRes.data ?? []) as Acompte[])
    } finally {
      setLoading(false)
    }
  }, [tenantId, annee])

  useEffect(() => { void load() }, [load])

  /* ── Calculs IS ────────────────────────────────────────────── */
  const resultatFiscal  = isData.resultat_brut + isData.charges_non_ded - isData.deductions
  const isBrut          = Math.max(0, Math.round(resultatFiscal * TAUX_IS))
  const minimumIS       = Math.max(PLANCHER_IS, Math.round(isData.ca_ht * TAUX_MIN_CA))
  const isDu            = Math.max(isBrut, minimumIS)                              // règle du minimum
  const baseAcompte     = Math.round(isDu * TAUX_ACOMPTE)                          // 25% par acompte
  const totalVerse      = acomptes.filter(a => a.statut === 'verse').reduce((s, a) => s + a.montant, 0)
  const soldeIS         = isDu - totalVerse

  async function saveAcompte() {
    if (!tenantId) return
    setSaving(true)
    const montant = Number(fMont) || baseAcompte
    const base    = Number(fBase) || isDu

    const { error } = await supabase.from('is_acomptes').insert({
      tenant_id: tenantId, annee,
      trimestre: fTrim, base, montant,
      statut: fStatut, date_versement: fStatut === 'verse' ? fDate : null,
      reference: fRef || null, notes: fNotes || null,
    })
    if (!error) {
      setSaveOk(true)
      setTimeout(() => { setSaveOk(false); setShowModal(false); resetForm(); void load() }, 1000)
    }
    setSaving(false)
  }

  function resetForm() {
    setFTrim(1); setFBase(''); setFMont(''); setFDate(new Date().toISOString().slice(0, 10))
    setFRef(''); setFNotes(''); setFStatut('verse')
  }

  function exportCSV() {
    const rows = [
      ['IS Congo-Brazzaville', annee],
      ['CA HT', isData.ca_ht],
      ['Résultat brut comptable', isData.resultat_brut],
      ['Résultat fiscal', resultatFiscal],
      ['IS brut (30%)', isBrut],
      ['Minimum forfaitaire (1% CA, plancher 500 000)', minimumIS],
      ['IS DÛ', isDu],
      ['Total versé', totalVerse],
      ['Solde à payer', soldeIS],
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `is-${annee}.csv`; a.click()
  }

  function StatutBadge({ s }: { s: string }) {
    if (s === 'verse')     return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A] flex items-center gap-1"><CheckCircle2 size={10} /> Versé</span>
    if (s === 'exonere')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#64748B]">Exonéré</span>
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] flex items-center gap-1"><Clock size={10} /> À verser</span>
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement IS...
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <TrendingUp size={22} className="text-[#7C3AED]" />
            Impôt sur les Sociétés (IS)
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Congo-Brazzaville · Taux 30% · Minimum 1% CA HT · SYSCOHADA 891/444
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {ANNEES.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-[12px] font-bold hover:bg-[#6D28D9]">
            <Plus size={13} /> Acompte
          </button>
        </div>
      </div>

      {/* KPIs IS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Résultat fiscal',     value: fmtFCFA(Math.abs(resultatFiscal)), color: resultatFiscal >= 0 ? '#16A34A' : '#DC2626' },
          { label: `IS brut (${(TAUX_IS * 100).toFixed(0)}%)`, value: fmtFCFA(isBrut), color: '#7C3AED' },
          { label: 'IS DÛ (avec min.)',   value: fmtFCFA(isDu),           color: '#0F172A' },
          { label: 'Solde à payer',       value: fmtFCFA(Math.abs(soldeIS)), color: soldeIS > 0 ? '#DC2626' : '#16A34A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">{k.label}</p>
            <p className="text-[18px] font-extrabold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Calcul détaillé */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
        <p className="text-[13px] font-bold text-[#0F172A]">Détail du calcul IS {annee}</p>

        {[
          { label: "Chiffre d'affaires HT (70+71)",         value: isData.ca_ht,           color: '#16A34A' },
          { label: 'Charges déductibles (classe 6)',         value: -isData.resultat_brut + isData.ca_ht, color: '#DC2626' },
          { label: 'Résultat brut comptable',                value: isData.resultat_brut,   color: '#2563EB' },
          { label: 'Charges non déductibles (+)',            value: isData.charges_non_ded, color: '#D97706' },
          { label: 'Déductions fiscales (−)',                value: -isData.deductions,     color: '#16A34A' },
          { label: 'RÉSULTAT FISCAL IMPOSABLE',             value: resultatFiscal,          color: '#0F172A', bold: true },
          { label: `IS brut (${(TAUX_IS * 100).toFixed(0)}% du résultat fiscal)`,  value: isBrut,   color: '#7C3AED' },
          { label: `Minimum forfaitaire (${(TAUX_MIN_CA * 100).toFixed(0)}% CA HT, plancher ${fmtFCFA(PLANCHER_IS)})`, value: minimumIS, color: '#64748B' },
          { label: 'IS DÛ (max(brut, minimum))',            value: isDu,                    color: '#DC2626', bold: true },
        ].map(row => (
          <div key={row.label} className={`flex justify-between items-center py-2 border-b border-[#F1F5F9] last:border-0 ${row.bold ? 'bg-[#F8FAFC] px-3 rounded-lg' : ''}`}>
            <span className={`text-[12px] ${row.bold ? 'font-extrabold text-[#0F172A]' : 'text-[#64748B]'}`}>{row.label}</span>
            <span className="text-[13px] font-bold" style={{ color: row.color }}>
              {row.value !== 0 ? fmtFCFA(Math.abs(row.value)) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Acomptes provisionnels */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#0F172A]">Acomptes provisionnels</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">3 versements à 25% de l&apos;IS estimé · Solde en avril N+1</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#94A3B8]">Base estimée / acompte</p>
            <p className="text-[16px] font-extrabold text-[#7C3AED]">{fmtFCFA(baseAcompte)}</p>
          </div>
        </div>

        {[1, 2, 3, 4].map(trim => {
          const ac = acomptes.find(a => a.trimestre === trim)
          return (
            <div key={trim} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F1F5F9] last:border-0">
              <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-extrabold text-[#7C3AED]">T{trim}</span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[#0F172A]">Acompte {MOIS_ACOMPTE[trim]}</p>
                {ac?.date_versement && (
                  <p className="text-[10px] text-[#94A3B8]">
                    Versé le {new Date(ac.date_versement).toLocaleDateString('fr-FR')}
                    {ac.reference ? ` · Réf. ${ac.reference}` : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[13px] font-extrabold text-[#0F172A]">
                  {ac ? fmtFCFA(ac.montant) : fmtFCFA(baseAcompte)}
                </p>
              </div>
              <StatutBadge s={ac?.statut ?? 'a_verser'} />
            </div>
          )
        })}

        {/* Récap */}
        <div className="px-5 py-3 bg-[#F8FAFC] flex justify-between items-center">
          <span className="text-[12px] font-semibold text-[#64748B]">Total versé</span>
          <span className="text-[13px] font-extrabold text-[#16A34A]">{fmtFCFA(totalVerse)}</span>
        </div>
        <div className={`px-5 py-3 flex justify-between items-center ${soldeIS > 0 ? 'bg-[#FEF2F2]' : 'bg-[#F0FDF4]'}`}>
          <span className="text-[12px] font-bold text-[#0F172A]">Solde IS {annee}</span>
          <span className="text-[14px] font-extrabold" style={{ color: soldeIS > 0 ? '#DC2626' : '#16A34A' }}>
            {soldeIS > 0 ? `à payer : ${fmtFCFA(soldeIS)}` : `excédent : ${fmtFCFA(Math.abs(soldeIS))}`}
          </span>
        </div>
      </div>

      {/* Note légale */}
      <div className="rounded-xl border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
        <div className="flex items-start gap-2">
          <Info size={13} className="text-[#7C3AED] shrink-0 mt-0.5" />
          <div className="text-[11px] text-[#64748B] space-y-1 leading-relaxed">
            <p><strong className="text-[#0F172A]">IS Congo (CGI art. 40)</strong> : Taux normal 30% du résultat fiscal net.</p>
            <p><strong className="text-[#0F172A]">Minimum forfaitaire</strong> : 1% du CA HT, avec plancher de 500 000 FCFA — même en cas de perte.</p>
            <p><strong className="text-[#0F172A]">Acomptes</strong> : 3 acomptes de 25% chacun (avr, juil, oct) calculés sur l&apos;IS de l&apos;exercice précédent.</p>
            <p><strong className="text-[#0F172A]">Déclaration annuelle</strong> : à déposer avant le 30 avril de l&apos;exercice suivant (liasse fiscale DGI).</p>
            <p><strong className="text-[#0F172A]">Comptes SYSCOHADA</strong> : 891 IS de l&apos;exercice (charge) · 444 État IS à payer (passif).</p>
          </div>
        </div>
      </div>

      {/* Modal acompte */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] text-[15px]">Enregistrer un acompte IS</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Trimestre</label>
                  <select value={fTrim} onChange={e => setFTrim(Number(e.target.value) as 1|2|3|4)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30">
                    {[1,2,3,4].map(t => <option key={t} value={t}>{MOIS_ACOMPTE[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Statut</label>
                  <select value={fStatut} onChange={e => setFStatut(e.target.value as 'verse'|'a_verser')}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30">
                    <option value="verse">Versé</option>
                    <option value="a_verser">À verser</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Base IS ({annee}) FCFA</label>
                  <input type="number" value={fBase} onChange={e => setFBase(e.target.value)}
                    placeholder={String(isDu)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Montant versé FCFA</label>
                  <input type="number" value={fMont} onChange={e => setFMont(e.target.value)}
                    placeholder={String(baseAcompte)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
                </div>
              </div>
              {fStatut === 'verse' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date versement</label>
                    <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Référence reçu DGI</label>
                    <input type="text" value={fRef} onChange={e => setFRef(e.target.value)}
                      placeholder="IS-2026-001"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <input type="text" value={fNotes} onChange={e => setFNotes(e.target.value)}
                  placeholder="Observations..."
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
              </div>
              {saveOk && (
                <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={13} /> Acompte enregistré !
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => void saveAcompte()} disabled={saving}
                  className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={() => { setShowModal(false); resetForm() }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
