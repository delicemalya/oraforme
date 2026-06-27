'use client'

/**
 * DataSourceBadge — Transparence des sources de données pour le BCI
 *
 * Sprint 148 — Quick Win BCI : chaque écran financier doit afficher
 * sa source de données, son statut Realtime, et l'origine des montants.
 * Objectif : l'utilisateur comprend immédiatement pourquoi deux écrans
 * peuvent afficher des montants différents (HT vs TTC, journal_entries
 * vs accounting_events, trésorerie vs comptabilité).
 */

import { Database, Zap, Clock, Info } from 'lucide-react'

interface DataSourceBadgeProps {
  /** Table(s) Supabase lues par cet écran */
  tables: string[]
  /** Supabase Realtime actif sur cette table */
  realtime?: boolean
  /** Date de la dernière synchronisation des données */
  lastSync?: Date | null
  /** Type de montants affichés (pour BCI cohérence) */
  amounts?: 'HT' | 'TTC' | 'HT+TVA+TTC' | 'comptable' | 'trésorerie' | 'mixte'
  /** Explication affichée en infobulle ou banner */
  explanation?: string
  className?: string
}

const AMOUNTS_CONFIG: Record<string, { label: string; color: string }> = {
  'HT':          { label: 'Montants HT',          color: '#2563EB' },
  'TTC':         { label: 'Montants TTC',          color: '#D97706' },
  'HT+TVA+TTC':  { label: 'HT · TVA · TTC',       color: '#7C3AED' },
  'comptable':   { label: 'Soldes comptables',     color: '#0891B2' },
  'trésorerie':  { label: 'Flux de trésorerie',    color: '#16A34A' },
  'mixte':       { label: 'Montants mixtes',       color: '#DC2626' },
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 10)  return 'à l\'instant'
  if (s < 60)  return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function DataSourceBadge({
  tables,
  realtime = false,
  lastSync = null,
  amounts,
  explanation,
  className = '',
}: DataSourceBadgeProps) {
  const amountCfg = amounts ? AMOUNTS_CONFIG[amounts] : null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>

      {/* Source tables */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
        <Database size={10} className="text-[#64748B]" />
        <span className="text-[10px] font-mono text-[#64748B]">
          {tables.join(' + ')}
        </span>
      </div>

      {/* Realtime status */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
        realtime
          ? 'bg-[#F0FDF4] border-[#86EFAC]'
          : 'bg-[#FFF7ED] border-[#FED7AA]'
      }`}>
        {realtime ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            <Zap size={9} className="text-[#16A34A]" />
            <span className="text-[10px] font-medium text-[#16A34A]">Realtime</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
            <span className="text-[10px] font-medium text-[#D97706]">Manuel</span>
          </>
        )}
      </div>

      {/* Last sync */}
      {lastSync && (
        <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
          <Clock size={9} />
          <span>{timeAgo(lastSync)}</span>
        </div>
      )}

      {/* Amount type */}
      {amountCfg && (
        <div className="px-2.5 py-1 rounded-lg border text-[10px] font-semibold"
          style={{ color: amountCfg.color, borderColor: amountCfg.color + '40', background: amountCfg.color + '10' }}>
          {amountCfg.label}
        </div>
      )}

      {/* Explanation tooltip */}
      {explanation && (
        <button
          title={explanation}
          className="flex items-center justify-center w-4 h-4 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition-colors"
        >
          <Info size={9} className="text-[#2563EB]" />
        </button>
      )}
    </div>
  )
}

/**
 * SourceExplainBanner — Bannière d'explication complète pour les différences de montants
 * À afficher sous le header des écrans comptables pour prévenir toute confusion BCI.
 */
interface SourceExplainBannerProps {
  screen: 'grand-livre' | 'balance' | 'finance' | 'tresorerie' | 'reporting' | 'direction'
}

const BANNER_CONTENT: Record<SourceExplainBannerProps['screen'], { icon: string; text: string }> = {
  'grand-livre': {
    icon: '📖',
    text: 'Source : journal_entries · Toutes les écritures des modules migrés (Facturation, Paie, Stocks, Achats, ONG, Restaurant…) + saisies manuelles. Les montants sont des soldes comptables SYSCOHADA, pas des montants HT/TTC.',
  },
  'balance': {
    icon: '⚖️',
    text: 'Source : journal_entries · Totaux débit/crédit/solde par compte SYSCOHADA. Le total débit = total crédit (principe de la partie double). Différent de la trésorerie (qui mesure les flux réels de caisse).',
  },
  'finance': {
    icon: '📊',
    text: 'CA = montant_ttc des factures payées · Charges = montant des transactions sortie · Trésorerie = soldes comptes_bancaires + caisses + wallets. Ces trois sources se complètent et ne doivent pas être additionnées.',
  },
  'tresorerie': {
    icon: '💵',
    text: 'Source : transactions · Montants bruts (entrées/sorties de caisse et virements). Différent du CA comptable (HT). Différent du Grand Livre (écritures en partie double). La trésorerie mesure les flux réels de liquidités.',
  },
  'reporting': {
    icon: '📋',
    text: 'Source : journal_entries · Données agrégées par période. En attente de la migration LEC pour unifier avec accounting_event_log et produire des rapports temps réel multi-sources.',
  },
  'direction': {
    icon: '🎯',
    text: 'CA (TTC) = montant_ttc factures · Trésorerie = soldes bancaires + caisses · Charges = transactions sortie. Ces indicateurs sont complémentaires : le CA TTC inclut la TVA, la trésorerie mesure le cash disponible.',
  },
}

export function SourceExplainBanner({ screen }: SourceExplainBannerProps) {
  const content = BANNER_CONTENT[screen]
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]">
      <span className="text-sm shrink-0">{content.icon}</span>
      <p className="text-[11px] text-[#1E40AF] leading-relaxed">
        <strong>Origine des données · </strong>{content.text}
      </p>
    </div>
  )
}
