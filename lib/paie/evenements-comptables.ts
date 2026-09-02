/**
 * lib/paie/evenements-comptables.ts
 *
 * Contrat unique entre un bulletin de paie et le moteur comptable.
 *
 * La migration 141 a supprimé le trigger trg_bulletins_paie et confié les
 * écritures de paie à emit_accounting_event(), à raison de :
 *
 *   PAI-001  constatation du salaire   statut → validee
 *            montant_ht = brut, metadata = { cnss_patronal, cnss_salarie, irpp }
 *            4 écritures : 661/421 · 664/431 · 421/431 · 421/447
 *   PAI-002  paiement du net           statut → payee
 *            montant_ttc = net, metadata = { mode_paiement }
 *            1 écriture  : 421 / compte de trésorerie résolu par mode_paiement
 *
 * Trois routes écrivaient chacune leurs propres paramètres, et la seule route
 * appelée par l'interface n'émettait rien du tout. Ce module est le seul
 * endroit où le bulletin est traduit en événements ; les routes ne font que
 * transmettre le résultat à supabase.rpc('emit_accounting_event').
 *
 * Pourquoi PAI-001 porte montant_ttc = 0 : le module PAI est déclaré à impact
 * de trésorerie (fn_ae_has_treasury_impact, migration 138:585). Tout événement
 * PAI dont montant_ttc > 0 crée une ligne transactions sous la contrainte
 * UNIQUE (tenant_id, source, source_id). Passer le net en montant_ttc sur
 * PAI-001 consommait cette unicité à la validation, et PAI-002 échouait
 * ensuite au paiement avec l'erreur 23505. La sortie de trésorerie n'a lieu
 * qu'au paiement : elle appartient à PAI-002 seul.
 *
 * Fonctions pures : aucun appel réseau, aucune lecture d'horloge.
 */

import { periodeMensuelle } from '@/lib/erp-core/compute/accounting'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatutBulletin = 'brouillon' | 'generee' | 'validee' | 'payee' | 'annule'

/** Colonnes de bulletins_paie nécessaires au contrat (migrations 007, 046, 077). */
export interface BulletinComptable {
  id:             string
  mois:           number
  annee:          number
  statut:         string | null
  brut:           number | string | null
  net:            number | string | null
  cnss_salarie:   number | string | null
  cnss_patronal:  number | string | null
  irpp:           number | string | null
  mode_paiement?: string | null
  date_paiement?: string | null
  /** Nom de l'employé, pour le libellé ; hors table bulletins_paie. */
  employe_nom?:   string | null
}

/**
 * Sélecteur PostgREST à passer après upsert/update pour obtenir tout ce que
 * le contrat consomme, y compris le nom de l'employé par jointure.
 */
export const BULLETIN_COMPTABLE_SELECT =
  'id, mois, annee, statut, brut, net, cnss_salarie, cnss_patronal, irpp, mode_paiement, date_paiement, employes(nom)' as const

export type TypeEvenementPaie = 'PAI-001' | 'PAI-002'

/** Paramètres exacts de emit_accounting_event (migration 138:826). */
export interface EvenementComptablePaie {
  p_tenant_id:     string
  p_event_type:    TypeEvenementPaie
  p_source_module: 'paie'
  p_source_table:  'bulletins_paie'
  p_source_id:     string
  p_montant_ht:    number
  p_montant_tva:   0
  p_montant_ttc:   number
  p_montant_net:   number
  p_libelle:       string
  p_date_event:    string
  p_fiscal_year:   number
  p_metadata:      Record<string, unknown>
  p_event_version: 1
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOIS_COURTS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/** Montant numérique, 0 pour null/vide/non numérique. Jamais NaN. */
export function montant(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Dernier jour du mois, en AAAA-MM-JJ.
 *
 * La constatation du salaire est une charge du mois : elle est datée du
 * dernier jour de ce mois, quel que soit le jour où le bulletin est validé.
 * Date.UTC évite tout décalage de fuseau ; le jour 0 du mois suivant est le
 * dernier jour du mois demandé. periodeMensuelle() valide les bornes.
 */
export function dernierJourDuMois(annee: number, mois: number): string {
  periodeMensuelle(annee, mois)
  const jour = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

function estDateISO(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

// ── Contrat ───────────────────────────────────────────────────────────────────

/**
 * Événements comptables qu'un bulletin doit avoir émis dans son statut actuel.
 *
 *   brouillon, generee, annule  → aucun
 *   validee                     → PAI-001
 *   payee                       → PAI-001 puis PAI-002
 *
 * Un bulletin payé renvoie aussi PAI-001 : si la validation n'était jamais
 * passée par le moteur, le paiement rattrape la constatation. Le moteur
 * ignore les doublons par (tenant, event_type, source_table, source_id)
 * (migration 138:890), donc réémettre est sans effet et sans risque.
 *
 * @param datePaiement  date du paiement pour PAI-002, AAAA-MM-JJ. Le bulletin
 *                      porte date_paiement ; sinon l'appelant fournit la date
 *                      du jour, ce module ne lit pas l'horloge.
 */
export function evenementsComptablesBulletin(
  tenantId: string,
  b: BulletinComptable,
  datePaiement: string,
): EvenementComptablePaie[] {
  const statut = (b.statut ?? '') as StatutBulletin
  if (statut !== 'validee' && statut !== 'payee') return []

  if (!b.id)     throw new RangeError('Bulletin sans identifiant')
  if (!tenantId) throw new RangeError('Bulletin sans tenant')

  const mois  = Number(b.mois)
  const annee = Number(b.annee)
  const fin   = dernierJourDuMois(annee, mois)   // valide aussi mois et année

  const brut = montant(b.brut)
  const net  = montant(b.net)
  if (brut < 0) throw new RangeError(`Brut négatif sur le bulletin ${b.id}`)
  if (net  < 0) throw new RangeError(`Net négatif sur le bulletin ${b.id}`)

  const employeNom = (b.employe_nom ?? '').trim() || 'Employé'
  const periode    = `${MOIS_COURTS[mois]} ${annee}`
  const base       = { mois, annee, employe_nom: employeNom }

  const constatation: EvenementComptablePaie = {
    p_tenant_id:     tenantId,
    p_event_type:    'PAI-001',
    p_source_module: 'paie',
    p_source_table:  'bulletins_paie',
    p_source_id:     b.id,
    p_montant_ht:    brut,
    p_montant_tva:   0,
    p_montant_ttc:   0,
    p_montant_net:   net,
    p_libelle:       `Bulletin paie ${periode} — ${employeNom} — constatation`,
    p_date_event:    fin,
    p_fiscal_year:   annee,
    p_metadata: {
      ...base,
      cnss_patronal: montant(b.cnss_patronal),
      cnss_salarie:  montant(b.cnss_salarie),
      irpp:          montant(b.irpp),
    },
    p_event_version: 1,
  }

  if (statut === 'validee') return [constatation]

  const date = estDateISO(b.date_paiement) ? b.date_paiement : datePaiement
  if (!estDateISO(date)) throw new RangeError(`Date de paiement invalide : ${String(date)}`)

  const paiement: EvenementComptablePaie = {
    p_tenant_id:     tenantId,
    p_event_type:    'PAI-002',
    p_source_module: 'paie',
    p_source_table:  'bulletins_paie',
    p_source_id:     b.id,
    p_montant_ht:    0,
    p_montant_tva:   0,
    p_montant_ttc:   net,
    p_montant_net:   net,
    p_libelle:       `Paiement salaire ${periode} — ${employeNom}`,
    p_date_event:    date,
    p_fiscal_year:   annee,
    p_metadata: {
      ...base,
      mode_paiement: (b.mode_paiement ?? '').trim() || 'virement',
    },
    p_event_version: 1,
  }

  return [constatation, paiement]
}

/**
 * Ligne telle que PostgREST la renvoie avec BULLETIN_COMPTABLE_SELECT :
 * la jointure employes arrive en objet (ou tableau selon la cardinalité
 * inférée). Cette fonction aplatit vers BulletinComptable.
 */
export function depuisLignePostgrest(row: Record<string, unknown>): BulletinComptable {
  const emp = row.employes
  const nom = Array.isArray(emp)
    ? (emp[0] as { nom?: string } | undefined)?.nom
    : (emp as { nom?: string } | null | undefined)?.nom
  return {
    id:            String(row.id ?? ''),
    mois:          Number(row.mois),
    annee:         Number(row.annee),
    statut:        (row.statut as string | null) ?? null,
    brut:          row.brut          as number | string | null,
    net:           row.net           as number | string | null,
    cnss_salarie:  row.cnss_salarie  as number | string | null,
    cnss_patronal: row.cnss_patronal as number | string | null,
    irpp:          row.irpp          as number | string | null,
    mode_paiement: (row.mode_paiement as string | null) ?? null,
    date_paiement: (row.date_paiement as string | null) ?? null,
    employe_nom:   nom ?? null,
  }
}
