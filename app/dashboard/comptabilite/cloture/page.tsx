'use client'

/**
 * Clôture Comptable OHADA
 * Processus de clôture mensuelle / annuelle
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { Lock, CheckCircle2, AlertTriangle, Clock, ChevronRight, RefreshCw } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface Movement {
  id: string; date_operation: string; debit_account: string
  credit_account: string; montant: number
}

interface ClotureMois {
  mois: number; annee: number; label: string
  nb_ecritures: number; total_debit: number; total_credit: number
  est_equilibree: boolean; statut: 'ouverte' | 'verifiee' | 'cloturee'
}

interface ClotureRecord {
  id: string; tenant_id: string; mois: number; annee: number
  statut: 'ouverte' | 'verifiee' | 'cloturee'; cloture_le: string
  cloture_par: string; notes: string
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const YEARS = [2024, 2025, 2026, 2027]

const STEPS_CLOTURE = [
  { id: 1, label: 'Vérification équilibre débit/crédit', desc: 'Tous les mois doivent être équilibrés' },
  { id: 2, label: 'Rapprochements bancaires', desc: 'Comptes 521 rapprochés avec relevés' },
  { id: 3, label: 'Inventaire stocks', desc: 'Comptes 3 mis à jour' },
  { id: 4, label: 'Dotations aux amortissements', desc: 'Comptes 28 & 68 enregistrés' },
  { id: 5, label: 'Provisions & charges à payer', desc: 'Comptes 49 & 481 comptabilisés' },
  { id: 6, label: 'TVA & déclarations fiscales', desc: 'TVA déclarée et payée' },
  { id: 7, label: 'Résultat de l\'exercice', desc: 'Compte 13 recalculé' },
  { id: 8, label: 'Affectation du résultat', desc: 'Réserves légales, dividendes' },
]

export default function CloturePage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [movements, setMovements]   = useState<Movement[]>([])
  const [clotures, setClotures]     = useState<ClotureRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [year, setYear]             = useState(new Date().getFullYear())
  const [stepsChecked, setStepsChecked] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState<string | null>(null)
  const [notes, setNotes]           = useState('')
  const [clotureAnnuelle, setClotureAnnuelle] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [mvR, clR] = await Promise.all([
        supabase.from('journal_entries')
          .select('id, date_operation, debit_account, credit_account, montant')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', year).limit(200),
        supabase.from('clotures_comptables')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('annee', year).limit(200),
      ])
      setMovements((mvR.data || []) as Movement[])
      if (clR.error?.code !== '42P01') setClotures((clR.data || []) as ClotureRecord[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Build monthly status */
  const moisData = useMemo<ClotureMois[]>(() => {
    return MONTHS_FR.map((label, idx) => {
      const mois   = idx + 1
      const mvMois = movements.filter(m => new Date(m.date_operation).getMonth() + 1 === mois)
      const td     = mvMois.reduce((s, m) => s + m.montant, 0)  // each mv has both sides so count once per side
      const totalDebit  = movements.filter(m => new Date(m.date_operation).getMonth() + 1 === mois && m.debit_account).reduce((s, m) => s + m.montant, 0)
      const totalCredit = movements.filter(m => new Date(m.date_operation).getMonth() + 1 === mois && m.credit_account).reduce((s, m) => s + m.montant, 0)
      const est_equilibree = Math.abs(totalDebit - totalCredit) < 1

      const clotureRec = clotures.find(c => c.mois === mois)
      return {
        mois, annee: year, label,
        nb_ecritures: mvMois.length,
        total_debit: totalDebit, total_credit: totalCredit,
        est_equilibree,
        statut: clotureRec?.statut || (mvMois.length === 0 ? 'ouverte' : 'ouverte'),
      }
    })
  }, [movements, clotures, year])

  /* Annual status */
  const annualStats = useMemo(() => {
    const moisAvecEcritures = moisData.filter(m => m.nb_ecritures > 0)
    const tousClotures = moisAvecEcritures.every(m => m.statut === 'cloturee')
    const tousEquilibres = moisAvecEcritures.every(m => m.est_equilibree)
    const totalEcritures = moisData.reduce((s, m) => s + m.nb_ecritures, 0)
    return { moisAvecEcritures: moisAvecEcritures.length, tousClotures, tousEquilibres, totalEcritures }
  }, [moisData])

  async function cloturerMois(mois: number) {
    if (!tenantId) return
    setProcessing(`cloture-${mois}`)
    const existing = clotures.find(c => c.mois === mois)
    if (existing) {
      await supabase.from('clotures_comptables')
        .update({ statut: 'cloturee', cloture_le: new Date().toISOString(), notes })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
    } else {
      await supabase.from('clotures_comptables').insert({
        tenant_id: tenantId, mois, annee: year,
        statut: 'cloturee', cloture_le: new Date().toISOString(), notes,
      })
    }
    setProcessing(null)
    const { data } = await supabase.from('clotures_comptables')
      .select('*').eq('tenant_id', tenantId).eq('annee', year).limit(200)
    setClotures((data || []) as ClotureRecord[])
  }

  async function rouvrirMois(mois: number) {
    if (!tenantId) return
    setProcessing(`rouvrir-${mois}`)
    await supabase.from('clotures_comptables')
      .update({ statut: 'ouverte' })
      .eq('tenant_id', tenantId)
      .eq('mois', mois)
      .eq('annee', year)
    setProcessing(null)
    const { data } = await supabase.from('clotures_comptables')
      .select('*').eq('tenant_id', tenantId).eq('annee', year).limit(200)
    setClotures((data || []) as ClotureRecord[])
  }

  function toggleStep(id: number) {
    setStepsChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
            <Lock size={22} className="text-[#2563EB]" />
            {t('compta.cloture.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.cloture.subtitle')}
          </p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Annual status banner */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${
        annualStats.tousClotures && annualStats.tousEquilibres
          ? 'bg-[#F0FDF4] border-[#86EFAC]'
          : !annualStats.tousEquilibres
          ? 'bg-[#FEF2F2] border-[#FECACA]'
          : 'bg-[#FEF3C7] border-[#FDE68A]'
      }`}>
        {annualStats.tousClotures && annualStats.tousEquilibres
          ? <CheckCircle2 size={18} className="text-[#16A34A] mt-0.5 shrink-0" />
          : !annualStats.tousEquilibres
          ? <AlertTriangle size={18} className="text-[#DC2626] mt-0.5 shrink-0" />
          : <Clock size={18} className="text-[#D97706] mt-0.5 shrink-0" />}
        <div>
          <p className={`text-[13px] font-extrabold ${
            annualStats.tousClotures ? 'text-[#16A34A]' : !annualStats.tousEquilibres ? 'text-[#DC2626]' : 'text-[#D97706]'
          }`}>
            {annualStats.tousClotures && annualStats.tousEquilibres
              ? `Exercice ${year} — Clôture possible`
              : !annualStats.tousEquilibres
              ? `Attention — Balance déséquilibrée sur certains mois`
              : `Exercice ${year} — Clôtures mensuelles en cours`}
          </p>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            {annualStats.moisAvecEcritures} mois avec écritures · {annualStats.totalEcritures} écritures au total
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mois avec écritures',  value: annualStats.moisAvecEcritures, color: '#0F172A' },
          { label: 'Mois clôturés',        value: moisData.filter(m => m.statut === 'cloturee').length, color: '#16A34A' },
          { label: 'Mois déséquilibrés',   value: moisData.filter(m => m.nb_ecritures > 0 && !m.est_equilibree).length, color: '#DC2626' },
          { label: 'Écritures totales',    value: annualStats.totalEcritures, color: '#2563EB' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[22px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Months list */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="text-[13px] font-extrabold text-[#0F172A]">État mensuel</h2>
          {moisData.map(m => {
            const isCloture   = m.statut === 'cloturee'
            const isProcessing = processing === `cloture-${m.mois}` || processing === `rouvrir-${m.mois}`
            return (
              <div key={m.mois} className={`bg-white rounded-xl border overflow-hidden ${
                isCloture ? 'border-[#86EFAC]' : !m.est_equilibree && m.nb_ecritures > 0 ? 'border-[#FECACA]' : 'border-[#E2E8F0]'
              }`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status icon */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{
                    background: isCloture ? '#F0FDF4' : !m.est_equilibree && m.nb_ecritures > 0 ? '#FEF2F2' : '#F8FAFC'
                  }}>
                    {isCloture
                      ? <CheckCircle2 size={14} className="text-[#16A34A]" />
                      : !m.est_equilibree && m.nb_ecritures > 0
                      ? <AlertTriangle size={14} className="text-[#DC2626]" />
                      : <Clock size={14} className="text-[#94A3B8]" />}
                  </div>
                  <span className="text-[13px] font-bold text-[#0F172A] w-24 shrink-0">{m.label}</span>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[11px] font-bold text-[#0F172A]">{m.nb_ecritures}</div>
                      <div className="text-[9px] text-[#94A3B8]">Écritures</div>
                    </div>
                    <div>
                      <div className={`text-[11px] font-bold ${m.est_equilibree || m.nb_ecritures === 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                        {m.nb_ecritures === 0 ? '—' : m.est_equilibree ? '✓ OK' : '⚠ Écart'}
                      </div>
                      <div className="text-[9px] text-[#94A3B8]">Balance</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold" style={{
                        color: isCloture ? '#16A34A' : '#D97706'
                      }}>
                        {isCloture ? t('compta.cloture.stat.cloture') : m.nb_ecritures === 0 ? t('compta.cloture.stat.ouvert') : t('compta.cloture.stat.ouvert')}
                      </div>
                      <div className="text-[9px] text-[#94A3B8]">{t('common.status')}</div>
                    </div>
                  </div>
                  {/* Action */}
                  {m.nb_ecritures > 0 && (
                    isCloture ? (
                      <button
                        onClick={() => rouvrirMois(m.mois)}
                        disabled={!!isProcessing}
                        className="flex items-center gap-1 text-[11px] px-3 py-1.5 bg-[#F1F5F9] rounded-lg text-[#64748B] hover:bg-[#E2E8F0] shrink-0">
                        <RefreshCw size={11} /> Rouvrir
                      </button>
                    ) : m.est_equilibree ? (
                      <button
                        onClick={() => cloturerMois(m.mois)}
                        disabled={!!isProcessing}
                        className="flex items-center gap-1 text-[11px] px-3 py-1.5 bg-[#2563EB] text-white rounded-lg font-semibold hover:bg-[#1D4ED8] shrink-0">
                        <Lock size={11} /> {isProcessing ? t('common.loading') : t('compta.cloture.confirm')}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#DC2626] font-bold shrink-0">Déséquilibre</span>
                    )
                  )}
                </div>
                {/* Debit / credit detail */}
                {m.nb_ecritures > 0 && (
                  <div className="px-4 pb-2 flex gap-4">
                    <span className="text-[10px] text-[#64748B]">Débit: <strong className="text-[#2563EB]">{fmtFCFA(m.total_debit)}</strong></span>
                    <span className="text-[10px] text-[#64748B]">Crédit: <strong className="text-[#16A34A]">{fmtFCFA(m.total_credit)}</strong></span>
                    {!m.est_equilibree && (
                      <span className="text-[10px] text-[#DC2626] font-bold">
                        Écart: {fmtFCFA(Math.abs(m.total_debit - m.total_credit))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Checklist clôture */}
        <div className="space-y-4">
          <h2 className="text-[13px] font-extrabold text-[#0F172A]">
            Checklist clôture annuelle {year}
          </h2>
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            {STEPS_CLOTURE.map((step, idx) => {
              const isDone = stepsChecked.has(step.id)
              return (
                <div key={step.id}
                  onClick={() => toggleStep(step.id)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-all ${isDone ? 'bg-[#F0FDF4]' : ''}`}>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                    isDone ? 'bg-[#16A34A] border-[#16A34A]' : 'bg-white border-[#E2E8F0]'
                  }`}>
                    {isDone && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[12px] font-semibold ${isDone ? 'text-[#16A34A] line-through' : 'text-[#0F172A]'}`}>
                      {step.id}. {step.label}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex justify-between mb-2">
              <span className="text-[12px] font-bold text-[#0F172A]">Avancement</span>
              <span className="text-[12px] font-extrabold text-[#2563EB]">
                {stepsChecked.size}/{STEPS_CLOTURE.length}
              </span>
            </div>
            <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className="h-full bg-[#2563EB] rounded-full transition-all"
                style={{ width: `${(stepsChecked.size / STEPS_CLOTURE.length) * 100}%` }} />
            </div>
            {stepsChecked.size === STEPS_CLOTURE.length && (
              <p className="text-[11px] text-[#16A34A] font-bold mt-2 text-center">
                ✓ Toutes les étapes validées — Clôture prête
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] mb-1">Notes de clôture</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Observations, points particuliers…"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
