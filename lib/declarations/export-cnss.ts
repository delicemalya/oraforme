/**
 * Export Excel officiel CNSS Congo — format télédéclaration
 * Produit 2 fichiers :
 *   1. CNSS.xlsx         — cotisations sans TUS
 *   2. CNSS_TUS.xlsx     — cotisations avec TUS
 */

import * as XLSX from 'xlsx'
import type { DeclarationCNSS } from './cnss-congo'
import { periodeLabel } from './branding'

const fmt = (n: number) => Math.round(n)

// ── Utilitaire feuille ────────────────────────────────────────────────────────

function buildSheet(
  decl: DeclarationCNSS,
  entreprise: string,
  includeTUS: boolean,
): XLSX.WorkSheet {
  const periode = periodeLabel(decl.mois, decl.annee)
  const r = decl.recap

  // ── Entête ────────────────────────────────────────────────────────────────
  const rows: (string | number | undefined)[][] = [
    ['CAISSE NATIONALE DE SÉCURITÉ SOCIALE', '', '', '', '', '', '', '', ''],
    ['DÉCLARATION DES SALAIRES ET DES COTISATIONS SOCIALES', '', '', '', '', '', '', '', ''],
    [],
    ['Employeur :', entreprise, '', 'Période :', periode],
    ['N° immatriculation CNSS :', '', '', 'Date d\'établissement :', new Date().toLocaleDateString('fr-FR')],
    [],
  ]

  // ── En-têtes colonnes ─────────────────────────────────────────────────────
  const headers: string[] = [
    'N°',
    'Nom, Post-nom, Prénom',
    'N° CNSS',
    'Salaire Brut',
    'Base Vieillesse',
    'Part Agent (4%)',
    'VID Patronal (8%)',
    'Alloc. Familiales (10.03%)',
    'AT-Maladie (2.25%)',
  ]
  if (includeTUS) headers.push('TUS (3%)')
  headers.push('TOTAL PATRONAL')

  rows.push(headers)

  // ── Lignes nominatives ────────────────────────────────────────────────────
  for (const e of decl.employes) {
    const nomComplet = [e.nom, e.postnom, e.prenom].filter(Boolean).join(' ')
    const row: (string | number)[] = [
      e.numero_ordre,
      nomComplet,
      e.numero_cnss || '—',
      fmt(e.salaire_brut),
      fmt(e.base_vieillesse),
      fmt(e.cotisation_employe),
      fmt(e.cotisation_vieillesse),
      fmt(e.allocations_familiales),
      fmt(e.accidents_travail),
    ]
    if (includeTUS) row.push(fmt(e.cotisation_tus))
    row.push(includeTUS ? fmt(e.total_patronal) : fmt(e.cotisation_vieillesse + e.cotisation_at_mp_pf))
    rows.push(row)
  }

  // ── Ligne totaux ──────────────────────────────────────────────────────────
  rows.push([])
  const totalRow: (string | number)[] = [
    '',
    'TOTAUX',
    '',
    fmt(r.masse_salariale),
    fmt(r.base_vieillesse_total),
    fmt(r.cotisation_vieillesse_employe),
    fmt(r.cotisation_vieillesse_patronal),
    fmt(r.allocations_familiales_total),
    fmt(r.accidents_travail_total),
  ]
  if (includeTUS) totalRow.push(fmt(r.cotisation_tus_total))
  totalRow.push(includeTUS ? fmt(r.total_cotisations_patronales) : fmt(r.cotisation_vieillesse_patronal + r.cotisation_at_mp_pf_total))
  rows.push(totalRow)

  // ── Récapitulatif ─────────────────────────────────────────────────────────
  rows.push([], ['RÉCAPITULATIF'])
  rows.push(['Nombre d\'employés :', r.nb_employes])
  rows.push(['Masse salariale brute :', fmt(r.masse_salariale)])
  rows.push(['Total cotisations salariales (part agent) :', fmt(r.cotisation_vieillesse_employe)])
  rows.push(['Total cotisations patronales :', includeTUS ? fmt(r.total_cotisations_patronales) : fmt(r.cotisation_vieillesse_patronal + r.cotisation_at_mp_pf_total)])
  if (includeTUS) rows.push(['dont TUS (3%) :', fmt(r.cotisation_tus_total)])
  rows.push(['TOTAL À VERSER :', includeTUS ? fmt(r.total_a_verser) : fmt(r.total_sans_tus)])

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 5 },   // N°
    { wch: 30 },  // Nom
    { wch: 16 },  // N° CNSS
    { wch: 16 },  // Salaire brut
    { wch: 16 },  // Base vieillesse
    { wch: 16 },  // Part agent
    { wch: 18 },  // VID patronal
    { wch: 22 },  // AF
    { wch: 18 },  // AT
    ...(includeTUS ? [{ wch: 14 }] : []),
    { wch: 18 },  // Total
  ]

  return ws
}

// ── Export CNSS.xlsx ──────────────────────────────────────────────────────────

export function exporterExcelCNSS(decl: DeclarationCNSS, entreprise: string): Uint8Array {
  const wb = XLSX.utils.book_new()
  const wsListe  = buildSheet(decl, entreprise, false)
  XLSX.utils.book_append_sheet(wb, wsListe, 'Liste Nominative')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

// ── Export CNSS+TUS.xlsx ──────────────────────────────────────────────────────

export function exporterExcelCNSSTUS(decl: DeclarationCNSS, entreprise: string): Uint8Array {
  const wb = XLSX.utils.book_new()
  const wsListe  = buildSheet(decl, entreprise, true)
  XLSX.utils.book_append_sheet(wb, wsListe, 'Liste Nominative TUS')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

// ── Nom de fichier ────────────────────────────────────────────────────────────

export function nomFichierCNSS(decl: DeclarationCNSS, type: 'cnss' | 'cnss-tus'): string {
  const m = String(decl.mois).padStart(2, '0')
  return type === 'cnss'
    ? `CNSS_${decl.annee}_${m}.xlsx`
    : `CNSS_TUS_${decl.annee}_${m}.xlsx`
}
