'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { GraduationCap, CheckCircle2, AlertTriangle, Download } from 'lucide-react'

// Congo Brazzaville — Taxe d'apprentissage
// Taux : 1.2% de la masse salariale brute (art. 186 CGI Congo)
// Versement : annuel avant le 30 avril N+1
// Compte SYSCOHADA : 634 Taxes sur salaires / 447 État impôts retenus

const TAUX_TA = 0.012
const TAUX_FPC = 0.012 // Formation professionnelle continue : même assiette

interface Bulletin {
  id: string
  periode: string
  salaire_brut: number
  employe_nom?: string
}

interface TaxeRecord {
  id: string
  annee: number
  assiette: number
  montant_ta: number
  montant_fpc: number
  statut: 'a_verser' | 'verse' | 'exonere'
  date_versement: string | null
  reference: string | null
  notes: string | null
}

const YEARS = [2024, 2025, 2026, 2027]

export default function TaxeApprentissagePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [masseSalariale, setMasseSalariale] = useState(0)
  const [record, setRecord] = useState<TaxeRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [dateVersement, setDateVersement] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)

      // Calcul masse salariale depuis les bulletins de paie
      const { data: bulletins } = await supabase
        .from('bulletins_paie')
        .select('id, periode, salaire_brut')
        .eq('tenant_id', tenantId)
        .ilike('periode', `${year}%`)

      const total = (bulletins || []).reduce((s: number, b: Bulletin) => s + (b.salaire_brut || 0), 0)
      setMasseSalariale(total)

      // Chercher enregistrement existant
      const { data: rec } = await supabase
        .from('taxe_apprentissage')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('annee', year)
        .maybeSingle()

      setRecord(rec as TaxeRecord | null)
      if (rec) {
        setDateVersement(rec.date_versement || '')
        setReference(rec.reference || '')
        setNotes(rec.notes || '')
      }

      setLoading(false)
    })()
  }, [tenantId, year])

  const montantTA  = Math.round(masseSalariale * TAUX_TA)
  const montantFPC = Math.round(masseSalariale * TAUX_FPC)
  const totalDu    = montantTA + montantFPC

  const echeance = `${year + 1}-04-30`
  const isEnRetard = !record?.date_versement && new Date() > new Date(echeance)

  async function marquerVerse() {
    if (!tenantId || !dateVersement) return
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      annee: year,
      assiette: masseSalariale,
      montant_ta: montantTA,
      montant_fpc: montantFPC,
      statut: 'verse' as const,
      date_versement: dateVersement,
      reference: reference || null,
      notes: notes || null,
    }
    if (record?.id) {
      await supabase.from('taxe_apprentissage').update(payload).eq('id', record.id)
    } else {
      await supabase.from('taxe_apprentissage').insert(payload)
    }
    // Refresh
    const { data: rec } = await supabase
      .from('taxe_apprentissage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('annee', year)
      .maybeSingle()
    setRecord(rec as TaxeRecord | null)
    setSaving(false)
  }

  function exportCSV() {
    const rows = [
      { Libellé: 'Masse salariale brute', Montant: masseSalariale },
      { Libellé: `Taxe d'apprentissage (${TAUX_TA * 100}%)`, Montant: montantTA },
      { Libellé: `Formation professionnelle continue (${TAUX_FPC * 100}%)`, Montant: montantFPC },
      { Libellé: 'TOTAL À VERSER', Montant: totalDu },
      { Libellé: 'Statut', Montant: record?.statut || 'a_verser' },
      { Libellé: 'Date de versement', Montant: record?.date_versement || '—' },
      { Libellé: 'Référence', Montant: record?.reference || '—' },
    ]
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `taxe-apprentissage-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <GraduationCap size={22} className="text-[#7C3AED]" />
            Taxe d&apos;Apprentissage & FPC
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Art. 186 CGI Congo · Versement avant le 30/04/{year + 1}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Status banner */}
      {record?.statut === 'verse' ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]">
          <CheckCircle2 size={16} />
          <p className="text-[12px] font-bold">
            Versé le {new Date(record.date_versement!).toLocaleDateString('fr-FR')}
            {record.reference && ` · Réf. ${record.reference}`}
          </p>
        </div>
      ) : isEnRetard ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]">
          <AlertTriangle size={16} />
          <p className="text-[12px] font-bold">
            En retard — échéance 30/04/{year + 1} dépassée · Pénalités applicables
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#FFFBEB] border-[#FCD34D] text-[#D97706]">
          <AlertTriangle size={16} />
          <p className="text-[12px] font-bold">
            À verser avant le 30/04/{year + 1} à la DGI
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Masse salariale brute', value: fmtFCFA(masseSalariale), color: '#2563EB' },
          { label: `TA (${TAUX_TA * 100}%)`,  value: fmtFCFA(montantTA),  color: '#7C3AED' },
          { label: `FPC (${TAUX_FPC * 100}%)`, value: fmtFCFA(montantFPC), color: '#0891B2' },
          { label: 'TOTAL DÛ',                 value: fmtFCFA(totalDu),    color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="text-[18px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Détail calcul */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
        <h2 className="text-[13px] font-extrabold text-[#0F172A]">Détail du calcul {year}</h2>
        <div className="space-y-2 text-[12px]">
          {[
            { label: 'Assiette : masse salariale brute totale', value: fmtFCFA(masseSalariale) },
            { label: `Taxe d'apprentissage : ${masseSalariale.toLocaleString('fr-FR')} × 1,2%`, value: fmtFCFA(montantTA) },
            { label: `Formation professionnelle continue : ${masseSalariale.toLocaleString('fr-FR')} × 1,2%`, value: fmtFCFA(montantFPC) },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">{row.label}</span>
              <span className="font-bold text-[#0F172A]">{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2 font-extrabold text-[13px]">
            <span className="text-[#0F172A]">TOTAL À VERSER</span>
            <span className="text-[#DC2626]">{fmtFCFA(totalDu)}</span>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-[#94A3B8] space-y-0.5">
          <p>Compte SYSCOHADA débit : 634 — Taxes sur salaires</p>
          <p>Compte SYSCOHADA crédit : 447 — État, impôts retenus à la source</p>
        </div>
      </div>

      {/* Formulaire versement */}
      {record?.statut !== 'verse' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
          <h2 className="text-[13px] font-extrabold text-[#0F172A]">Enregistrer le versement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Date de versement *</label>
              <input type="date" value={dateVersement} onChange={e => setDateVersement(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Référence paiement</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="N° quittance DGI…"
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 resize-none" />
          </div>
          <button onClick={marquerVerse} disabled={!dateVersement || saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] text-white rounded-lg text-[12px] font-bold disabled:opacity-50">
            <CheckCircle2 size={14} />
            {saving ? 'Enregistrement…' : 'Marquer comme versé'}
          </button>
        </div>
      )}
    </div>
  )
}
