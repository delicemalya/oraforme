// ── Shared analytics types for Oraforme BI system ────────────────────────────

export interface BiKpi {
  label: string
  value: number
  formatted: string
  trend?: number          // % change vs prior period
  trendUp?: boolean       // true = up is good, false = up is bad
  sub?: string
  alert?: boolean
  badge?: string
}

// ── Monthly trend row ─────────────────────────────────────────────────────────
export interface MonthTrend {
  month: string          // 'Jan', 'Fév', ...
  [key: string]: string | number
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface BiAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  value?: number
  link?: string
}

// ── DG (Direction Générale) ───────────────────────────────────────────────────
export interface DgKpis {
  caAnnee: number
  caMois: number
  caPrevMois: number
  depAnnee: number
  depMois: number
  depPrevMois: number
  resultatNet: number
  margeNetPct: number
  tresoTotale: number
  creancesClients: number
  nbFacturesOuvertes: number
  nbFacturesRetard: number
  salairesAnnee: number
  effectifActif: number
  effectifTotal: number
  contratsExpirant30: number
}

export interface DgCharts {
  monthlyTrend: MonthTrend[]       // entrees, sorties, net
  revenueBySource: { name: string; value: number; color: string }[]
}

export interface DgInsights {
  kpis: DgKpis
  charts: DgCharts
  alerts: BiAlert[]
  lastUpdated: string
}

// ── RH ────────────────────────────────────────────────────────────────────────
export interface RhKpis {
  effectifActif: number
  effectifTotal: number
  nbConges: number
  masseSalMois: number
  masseSalAnnee: number
  nbRecrutements: number
  nbDemissions: number
  tauxPresence: number
  contratsExpirant30: number
  nbAbsencesTotal: number
}

export interface RhCharts {
  masseSalMensuelle: MonthTrend[]  // masse
  absencesParMois: MonthTrend[]    // absences
  effectifEvol: MonthTrend[]       // actifs
}

export interface RhInsights {
  kpis: RhKpis
  charts: RhCharts
  alerts: BiAlert[]
  lastUpdated: string
}

// ── École ─────────────────────────────────────────────────────────────────────
export interface EcoleKpis {
  nbEleves: number
  nbElevesMois: number
  scolAnnee: number
  scolMois: number
  nbImpayesFamilles: number
  montantImpayes: number
  txPaiement: number
  nbAbsences: number
  nbClassements: number
}

export interface EcoleCharts {
  scolParMois: MonthTrend[]        // montant
  absencesParMois: MonthTrend[]    // count
  paiementsStatus: { name: string; value: number; color: string }[]
}

export interface EcoleInsights {
  kpis: EcoleKpis
  charts: EcoleCharts
  alerts: BiAlert[]
  lastUpdated: string
}

// ── Hôtel ─────────────────────────────────────────────────────────────────────
export interface HotelKpis {
  nbChambres: number
  chambresOccupees: number
  tauxOccupation: number
  revenuAnnee: number
  revenuMois: number
  nbReservations: number
  revParChambre: number
}

export interface HotelInsights {
  kpis: HotelKpis
  alerts: BiAlert[]
  lastUpdated: string
}

// ── Restaurant ────────────────────────────────────────────────────────────────
export interface RestoKpis {
  ventesTotales: number
  ventesMois: number
  nbCommandes: number
  ticketMoyen: number
  topPlat: string
  heureFort: string
}

export interface RestoInsights {
  kpis: RestoKpis
  alerts: BiAlert[]
  lastUpdated: string
}
