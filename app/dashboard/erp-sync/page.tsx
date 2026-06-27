'use client'

/**
 * ERP Synchronization Matrix — Sprint S-01
 * Démontre qu'une seule action métier met à jour tous les modules concernés.
 * Affiche le ESI (ERP Synchronization Index) et la matrice événements × dimensions.
 */

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Minus, Info, Zap, Activity } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'ok' | 'partial' | 'no' | 'na'

interface DimensionResult {
  status:      SyncStatus
  source?:     string
  montant?:    string
  propagation: string
  note?:       string
}

interface EventRow {
  event:      string
  module:     string
  eventType:  string
  dimensions: Record<string, DimensionResult>
}

// ─── Données de la matrice ────────────────────────────────────────────────────

const DIMENSIONS = [
  'Direction', 'Finance', 'Comptabilité', 'Grand Livre', 'Balance', 'Journal',
  'Audit', 'Reporting', 'Analytics', 'Trésorerie', 'MIAA', 'Workflow', 'Notifications', 'Realtime',
]

const MATRIX: EventRow[] = [
  {
    event: 'Facture créée', module: 'Facturation', eventType: 'FAC-001',
    dimensions: {
      Direction:    { status: 'partial', source: 'factures', montant: 'TTC', propagation: 'Manuel', note: 'Pas de Realtime sur factures' },
      Finance:      { status: 'partial', source: 'fn_finance_kpis', montant: 'HT', propagation: 'Manuel + Realtime transactions', note: 'Realtime ajouté Sprint S-01' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', montant: 'HT', propagation: '< 1s via emit_accounting_event' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', source: 'audit_scores',   montant: 'mixte', propagation: 'Manuel (runAudit)' },
      Reporting:    { status: 'partial', source: 'journal_entries', montant: 'HT', propagation: 'Manuel', note: 'Bloqué LEC' },
      Analytics:    { status: 'partial', source: 'factures + transactions', montant: 'mixte', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — pas encore encaissé' },
      MIAA:         { status: 'partial', source: 'factures', propagation: 'Poll interne', note: 'Agents lisent factures' },
      Workflow:     { status: 'partial', propagation: 'Triggers postgres disponibles', note: 'Non connecté FAC-001' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté pour FAC-001' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto', note: '3 screens actifs' },
    },
  },
  {
    event: 'Paiement facture', module: 'Facturation', eventType: 'FAC-002',
    dimensions: {
      Direction:    { status: 'partial', source: 'factures', montant: 'TTC', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions + fn_finance_kpis', montant: 'TTC', propagation: '< 1s Realtime + reload' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', montant: 'HT', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'ok',      source: 'transactions', montant: 'TTC', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Bulletin de paie', module: 'Paie', eventType: 'PAI-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'fn_finance_kpis', montant: 'HT', propagation: 'Via transactions' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', montant: 'HT', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', montant: 'HT comptable', propagation: '< 1s Realtime' },
      Audit:        { status: 'ok',      source: 'paie_bulletins', propagation: 'Audit RH lit paie_bulletins' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'ok',      source: 'paie_bulletins', propagation: 'Module RH analytics' },
      Trésorerie:   { status: 'partial', propagation: 'Partiel — quand virement effectué' },
      MIAA:         { status: 'ok',      source: 'paie_bulletins', propagation: 'Agents RH actifs' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
  {
    event: 'Facture fournisseur', module: 'Achats', eventType: 'ACH-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'fn_finance_kpis', montant: 'HT', propagation: 'Via transactions + Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', montant: 'HT', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — pas encore payé' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
  {
    event: 'Réception stock', module: 'Stocks', eventType: 'STK-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: 'Via Realtime transactions' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — pas encore payé' },
      MIAA:         { status: 'partial', propagation: 'Alertes stock actives' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
  {
    event: 'Sortie stock', module: 'Stocks', eventType: 'STK-002',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: 'Via Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — mouvement interne' },
      MIAA:         { status: 'partial', propagation: 'Alertes stock actives' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
  {
    event: 'Vente Restaurant', module: 'Restaurant', eventType: 'RES-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', montant: 'TTC', propagation: '< 1s Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'ok',      source: 'commandes', propagation: 'Module analytics restaurant' },
      Trésorerie:   { status: 'ok',      source: 'transactions', montant: 'TTC', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Paiement École', module: 'École', eventType: 'ECO-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'ok',      source: 'ecole_paiements', propagation: 'Module analytics école' },
      Trésorerie:   { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Encaissement Hôtel', module: 'Hôtel', eventType: 'HOT-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'ok',      source: 'hotel_reservations', propagation: 'Module analytics hôtel' },
      Trésorerie:   { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Réception don ONG', module: 'ONG', eventType: 'ONG-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Vente Boisson', module: 'Boisson', eventType: 'BOI-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'ok',      source: 'transactions', propagation: '< 1s Realtime' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal + Trésorerie → auto' },
    },
  },
  {
    event: 'Chantier BTP', module: 'BTP', eventType: 'BTP-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: 'Via Realtime — Sprint S-01' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit — Sprint S-01', note: 'SQL mig.148 requis' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — règlement client à l\'achèvement' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
  {
    event: 'Récolte Agriculture', module: 'Agriculture', eventType: 'AGR-001',
    dimensions: {
      Direction:    { status: 'partial', propagation: 'Manuel' },
      Finance:      { status: 'ok',      source: 'transactions', propagation: 'Via Realtime — Sprint S-01' },
      Comptabilité: { status: 'ok',      source: 'journal_entries', propagation: '< 1s emit — Sprint S-01', note: 'SQL mig.148 requis' },
      'Grand Livre':{ status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Balance:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Journal:      { status: 'ok',      source: 'journal_entries', propagation: '< 1s Realtime' },
      Audit:        { status: 'partial', propagation: 'Manuel' },
      Reporting:    { status: 'partial', propagation: 'Manuel' },
      Analytics:    { status: 'partial', propagation: 'Manuel' },
      Trésorerie:   { status: 'na',      propagation: 'N/A — exonéré TVA, produits agricoles alimentaires' },
      MIAA:         { status: 'partial', propagation: 'Poll interne' },
      Workflow:     { status: 'partial', propagation: 'Triggers disponibles' },
      Notifications:{ status: 'no',     propagation: 'Non implémenté' },
      Realtime:     { status: 'ok',      propagation: 'GL + Balance + Journal → auto' },
    },
  },
]

// ─── ESI Calculator ───────────────────────────────────────────────────────────

function computeESI(): { esi: number; byDimension: Record<string, number> } {
  const dimScores: Record<string, number[]> = {}
  DIMENSIONS.forEach(d => { dimScores[d] = [] })

  for (const row of MATRIX) {
    for (const dim of DIMENSIONS) {
      const r = row.dimensions[dim]
      if (!r) { dimScores[dim].push(0); continue }
      const score = r.status === 'ok' ? 100 : r.status === 'partial' ? 50 : r.status === 'na' ? 100 : 0
      dimScores[dim].push(score)
    }
  }

  const byDimension: Record<string, number> = {}
  let total = 0
  for (const dim of DIMENSIONS) {
    const scores = dimScores[dim]
    const avg = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)
    byDimension[dim] = avg
    total += avg
  }

  return { esi: Math.round(total / DIMENSIONS.length), byDimension }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function StatusCell({ result, showTooltip }: { result: DimensionResult; showTooltip: string }) {
  const cfg: Record<SyncStatus, { icon: React.ReactNode; bg: string; text: string }> = {
    ok:      { icon: <CheckCircle2 size={13} />, bg: '#F0FDF4', text: '#16A34A' },
    partial: { icon: <AlertTriangle size={13} />, bg: '#FFFBEB', text: '#D97706' },
    no:      { icon: <XCircle size={13} />, bg: '#FEF2F2', text: '#DC2626' },
    na:      { icon: <Minus size={13} />, bg: '#F8FAFC', text: '#94A3B8' },
  }
  const c = cfg[result.status]
  return (
    <td
      className="px-2 py-2 text-center border-b border-[#F1F5F9] cursor-help"
      style={{ background: c.bg }}
      title={`${showTooltip}\n${result.propagation}${result.note ? '\n⚠ ' + result.note : ''}`}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span style={{ color: c.text }}>{c.icon}</span>
        <span className="text-[8px] leading-none" style={{ color: c.text }}>
          {result.status === 'ok' ? 'Sync' : result.status === 'partial' ? 'Part.' : result.status === 'na' ? 'N/A' : 'Non'}
        </span>
      </div>
    </td>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ERPSyncPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null)
  const { esi, byDimension } = computeESI()

  const esiColor = esi >= 90 ? '#16A34A' : esi >= 75 ? '#2563EB' : esi >= 60 ? '#D97706' : '#DC2626'
  const esiLabel = esi >= 90 ? 'Excellent' : esi >= 75 ? 'Bon' : esi >= 60 ? 'Moyen' : 'Critique'

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#EFF6FF]">
            <Activity size={22} className="text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Matrice de Synchronisation ERP</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Sprint S-01 · Une seule action = tous les modules synchronisés · 13 événements × 14 dimensions
            </p>
          </div>
        </div>
        {/* ESI Score */}
        <div className="flex items-center gap-4 px-5 py-3 rounded-2xl border" style={{ borderColor: esiColor + '40', background: esiColor + '10' }}>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: esiColor }}>ESI — ERP Sync Index</div>
            <div className="text-3xl font-black" style={{ color: esiColor }}>{esi}<span className="text-base font-normal">/100</span></div>
            <div className="text-[11px] font-medium" style={{ color: esiColor }}>{esiLabel}</div>
          </div>
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke={esiColor + '30'} strokeWidth="8" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={esiColor} strokeWidth="8"
                strokeDasharray={`${(esi / 100) * 163.4} 163.4`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[14px] font-black" style={{ color: esiColor }}>{esi}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Légende ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-center">
        {[
          { status: 'ok', label: 'Synchronisé automatiquement', color: '#16A34A', bg: '#F0FDF4', icon: <CheckCircle2 size={13} /> },
          { status: 'partial', label: 'Partiel (manuel ou délai)', color: '#D97706', bg: '#FFFBEB', icon: <AlertTriangle size={13} /> },
          { status: 'no', label: 'Non synchronisé', color: '#DC2626', bg: '#FEF2F2', icon: <XCircle size={13} /> },
          { status: 'na', label: 'Non applicable', color: '#94A3B8', bg: '#F8FAFC', icon: <Minus size={13} /> },
        ].map(l => (
          <div key={l.status} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium"
            style={{ color: l.color, background: l.bg, borderColor: l.color + '30' }}>
            {l.icon} {l.label}
          </div>
        ))}
        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
          <Info size={11} /> Survoler une cellule pour voir le détail
        </div>
      </div>

      {/* ── ESI par dimension ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {DIMENSIONS.map(dim => {
          const score = byDimension[dim]
          const col = score >= 90 ? '#16A34A' : score >= 70 ? '#2563EB' : score >= 50 ? '#D97706' : '#DC2626'
          return (
            <div key={dim} className="bg-white rounded-xl border border-[#E2E8F0] p-3 text-center">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-1">{dim}</div>
              <div className="text-xl font-black" style={{ color: col }}>{score}%</div>
              <div className="h-1.5 rounded-full bg-[#F1F5F9] mt-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: col }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Matrice principale ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-x-auto shadow-sm">
        <table className="w-full text-[11px] min-w-[900px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <th className="text-left px-4 py-3 font-bold text-[#0F172A] sticky left-0 bg-[#F8FAFC] min-w-[180px]">
                Événement métier
              </th>
              <th className="px-2 py-3 font-semibold text-[#374151] text-center min-w-[50px]">Type</th>
              {DIMENSIONS.map(d => (
                <th key={d} className="px-2 py-3 font-semibold text-[#374151] text-center min-w-[60px] whitespace-nowrap">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row, i) => (
              <tr
                key={row.eventType}
                className={`cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                  i % 2 === 0 ? '' : 'bg-[#FAFBFC]'
                } ${selectedEvent?.eventType === row.eventType ? 'ring-2 ring-[#2563EB] ring-inset' : ''}`}
                onClick={() => setSelectedEvent(selectedEvent?.eventType === row.eventType ? null : row)}
              >
                <td className="px-4 py-2 sticky left-0 bg-inherit border-b border-[#F1F5F9]">
                  <div className="font-semibold text-[#0F172A]">{row.event}</div>
                  <div className="text-[9px] text-[#94A3B8]">{row.module}</div>
                </td>
                <td className="px-2 py-2 text-center border-b border-[#F1F5F9]">
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] font-bold">
                    {row.eventType}
                  </span>
                </td>
                {DIMENSIONS.map(dim => (
                  <StatusCell key={dim} result={row.dimensions[dim] ?? { status: 'na', propagation: 'N/A' }} showTooltip={dim} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Détail événement sélectionné ────────────────────────────────────── */}
      {selectedEvent && (
        <div className="bg-white rounded-2xl border border-[#2563EB] shadow-sm p-5">
          <h3 className="font-bold text-[#0F172A] text-base mb-1">
            Détail : {selectedEvent.event}
            <span className="ml-2 font-mono text-[11px] px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB]">{selectedEvent.eventType}</span>
          </h3>
          <p className="text-[11px] text-[#64748B] mb-4">Module : {selectedEvent.module} · Cliquer à nouveau pour fermer</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DIMENSIONS.map(dim => {
              const r = selectedEvent.dimensions[dim] ?? { status: 'na' as SyncStatus, propagation: 'N/A' }
              const statusColors: Record<SyncStatus, string> = {
                ok: '#16A34A', partial: '#D97706', no: '#DC2626', na: '#94A3B8'
              }
              const c = statusColors[r.status]
              return (
                <div key={dim} className="rounded-xl border p-3" style={{ borderColor: c + '40', background: c + '08' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[11px] text-[#374151]">{dim}</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: c, background: c + '20' }}>
                      {r.status === 'ok' ? 'Sync auto' : r.status === 'partial' ? 'Partiel' : r.status === 'na' ? 'N/A' : 'Non sync'}
                    </span>
                  </div>
                  {r.source && <div className="text-[10px] text-[#64748B] font-mono mb-0.5">Source : {r.source}</div>}
                  {r.montant && <div className="text-[10px] text-[#64748B] mb-0.5">Montant : <strong>{r.montant}</strong></div>}
                  <div className="flex items-center gap-1 text-[10px]" style={{ color: c }}>
                    <Zap size={9} />
                    {r.propagation}
                  </div>
                  {r.note && (
                    <div className="mt-1 text-[9px] text-[#D97706] flex items-center gap-1">
                      <AlertTriangle size={8} /> {r.note}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Chemin vers ESI 95+ ─────────────────────────────────────────────── */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-5">
        <h3 className="font-bold text-[#1E40AF] mb-3 flex items-center gap-2">
          <Info size={16} /> Chemin vers ESI 95+
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
          <div className="bg-white rounded-xl p-3 border border-[#BFDBFE]">
            <div className="font-bold text-[#1E40AF] mb-1">Sprint S-02 — Direction Realtime</div>
            <p className="text-[#374151]">Ajouter Realtime sur factures → Direction se met à jour automatiquement. +8 ESI sur Direction.</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#BFDBFE]">
            <div className="font-bold text-[#1E40AF] mb-1">Sprint S-03 — Notifications financières</div>
            <p className="text-[#374151]">Connecter emit_accounting_event → notifications. Chaque FAC-001/PAI-001 déclenche une notification. +100% sur Notifications.</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#BFDBFE]">
            <div className="font-bold text-[#1E40AF] mb-1">Sprint LEC — Unification sources</div>
            <p className="text-[#374151]">Unifier journal_entries + accounting_events → Reporting + Analytics passent de partiel à sync auto. +15 ESI global.</p>
          </div>
        </div>
      </div>

    </div>
  )
}
