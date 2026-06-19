'use client'

import { useState } from 'react'
import { FileText, Plus, Download, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

const DEMO_CONTRATS = [
  { id: '1', ref: 'CTR-2026-001', candidat: 'Alain Nkounkou',   entreprise: 'Pétrogab S.A.',     poste: 'Comptable Senior', type: 'CDI',     date_signature: '2026-05-28', statut: 'signe',    salaire: '350 000' },
  { id: '2', ref: 'CTR-2026-002', candidat: 'Marie Oba',         entreprise: 'Hôpital Central',   poste: 'Infirmière chef',  type: 'CDD',     date_signature: '2026-05-12', statut: 'signe',    salaire: '280 000' },
  { id: '3', ref: 'CTR-2026-003', candidat: 'Paul Moukagni',     entreprise: 'CFAO Motors',        poste: 'Responsable RH',   type: 'CDI',     date_signature: null,         statut: 'en_attente', salaire: '420 000' },
  { id: '4', ref: 'CTR-2026-004', candidat: 'Jean-Baptiste Oko', entreprise: 'Orange Congo',       poste: 'Développeur IT',   type: 'Stage',   date_signature: '2026-04-01', statut: 'signe',    salaire: '120 000' },
]

const STATUT_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  signe:      { label: 'Signé',       color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle    },
  en_attente: { label: 'En attente',  color: '#D97706', bg: '#FFFBEB', icon: Clock          },
  expire:     { label: 'Expiré',      color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle  },
}

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  CDI:       { color: '#16A34A', bg: '#F0FDF4' },
  CDD:       { color: '#2563EB', bg: '#EFF6FF' },
  Stage:     { color: '#7C3AED', bg: '#F5F3FF' },
  Freelance: { color: '#D97706', bg: '#FFFBEB' },
  Intérim:   { color: '#0EA5E9', bg: '#F0F9FF' },
}

export default function ContratsPage() {
  const [filtre, setFiltre] = useState<'tous' | 'signe' | 'en_attente'>('tous')
  const filtered = DEMO_CONTRATS.filter(c => filtre === 'tous' || c.statut === filtre)

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Contrats</h1>
          <p className="text-[11px] text-[#64748B]">CDI, CDD, stage, intérim & freelance</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm">
          <Plus size={14} /> Nouveau contrat
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contrats signés',    value: DEMO_CONTRATS.filter(c => c.statut === 'signe').length,      color: '#16A34A' },
          { label: 'En attente signature',value: DEMO_CONTRATS.filter(c => c.statut === 'en_attente').length, color: '#D97706' },
          { label: 'CDI placés',          value: DEMO_CONTRATS.filter(c => c.type === 'CDI').length,           color: '#2563EB' },
          { label: 'Total contrats',      value: DEMO_CONTRATS.length,                                         color: '#475569' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{label}</p>
            <div className="mt-2 h-1 rounded-full" style={{ background: color + '30', width: '100%' }}>
              <div className="h-full rounded-full" style={{ background: color, width: `${Math.min(value * 25, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[{ key: 'tous', label: 'Tous' }, { key: 'signe', label: 'Signés' }, { key: 'en_attente', label: 'En attente' }].map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key as typeof filtre)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${filtre === f.key ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >{f.label}</button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="divide-y divide-[#F1F5F9]">
          {filtered.map(c => {
            const sc = STATUT_CFG[c.statut] ?? STATUT_CFG['signe']
            const ScIcon = sc.icon
            const tc = TYPE_COLORS[c.type] ?? { color: '#475569', bg: '#F1F5F9' }
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-[#FAFAFA] transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc.bg }}>
                  <FileText size={15} style={{ color: tc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-bold text-[#0F172A]">{c.candidat}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>{c.type}</span>
                    <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                      <ScIcon size={8} /> {sc.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] truncate">{c.poste} — {c.entreprise}</p>
                  <p className="text-[10px] text-[#94A3B8]">
                    {c.ref} ·{c.date_signature ? ` Signé le ${new Date(c.date_signature).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ' En attente de signature'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold text-[#0F172A]">{c.salaire} FCFA</p>
                  <button className="flex items-center gap-1 mt-1 text-[10px] text-[#2563EB] hover:underline font-semibold">
                    <Download size={10} /> PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-[#EFF6FF]/60 border border-[#2563EB]/10 rounded-xl p-4 text-center">
        <p className="text-[12px] text-[#1E40AF] font-medium">
          Données de démonstration. Générez et signez vos vrais contrats avec MIAA+ Job.
        </p>
      </div>
    </div>
  )
}
