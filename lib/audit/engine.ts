/**
 * lib/audit/engine.ts — Moteur d'audit OHADA
 * Calcule les scores et détecte les anomalies depuis les données Supabase.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuditLevel  = 'info' | 'warning' | 'critical' | 'error'
export type AuditDomain = 'comptable' | 'financier' | 'fiscal' | 'rh' | 'controle_interne' | 'risques' | 'ohada'

export interface AuditAnomalie {
  id:          string
  domain:      AuditDomain
  code:        string
  titre:       string
  description: string
  niveau:      AuditLevel
  impact:      string
  recommandation: string
  valeur?:     string | number
  reference?:  string // Référence OHADA/légale
}

export interface AuditScore {
  domain:     AuditDomain
  label:      string
  score:      number       // 0 → 100
  anomalies:  AuditAnomalie[]
  computed_at: string
}

export interface AuditGlobal {
  score_global:        number
  score_comptable:     number
  score_financier:     number
  score_fiscal:        number
  score_rh:            number
  score_controle:      number
  score_ohada:         number
  nb_anomalies:        number
  nb_critiques:        number
  nb_actions:          number
  anomalies:           AuditAnomalie[]
  computed_at:         string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
let _id = 0
const uid = (prefix: string) => `${prefix}-${++_id}`

function penalise(score: number, anomalies: AuditAnomalie[]): number {
  let s = score
  for (const a of anomalies) {
    if (a.niveau === 'critical') s -= 20
    else if (a.niveau === 'error')    s -= 12
    else if (a.niveau === 'warning')  s -= 6
    else s -= 2
  }
  return Math.max(0, Math.min(100, s))
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT COMPTABLE
// ══════════════════════════════════════════════════════════════════════════════

export async function auditComptable(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []
  const since90 = daysAgo(90)

  const [txRes, factRes] = await Promise.all([
    supabase.from('transactions').select('id, type, montant, reference, description, created_at')
      .eq('tenant_id', tenantId).gte('created_at', since90),
    supabase.from('factures').select('id, numero, total, statut, created_at')
      .eq('tenant_id', tenantId).gte('created_at', since90),
  ])

  const tx      = txRes.data ?? []
  const factures = factRes.data ?? []

  // 1. Transactions sans référence
  const sansSRef = tx.filter(t => !t.reference && !t.description)
  if (sansSRef.length > 0) {
    anomalies.push({
      id: uid('compta'), domain: 'comptable', code: 'C001',
      titre: 'Écritures sans référence',
      description: `${sansSRef.length} transaction(s) sans référence ni libellé.`,
      niveau: 'warning',
      impact: 'Traçabilité comptable insuffisante — non-conforme SYSCOHADA Art. 17',
      recommandation: 'Renseignez la référence pièce et le libellé pour chaque écriture.',
      valeur: sansSRef.length,
      reference: 'SYSCOHADA révisé, Art. 17 & 18',
    })
  }

  // 2. Factures sans numéro séquentiel
  const numéros = factures.map(f => f.numero).filter(Boolean)
  const dupes = numéros.filter((n, i) => numéros.indexOf(n) !== i)
  if (dupes.length > 0) {
    anomalies.push({
      id: uid('compta'), domain: 'comptable', code: 'C002',
      titre: 'Numéros de factures dupliqués',
      description: `${dupes.length} numéro(s) dupliqué(s) : ${dupes.slice(0, 3).join(', ')}…`,
      niveau: 'critical',
      impact: 'Non-conformité OHADA — les numéros de factures doivent être uniques et chronologiques.',
      recommandation: 'Corrigez la numérotation. Les factures doivent être séquentielles sans saut ni doublon.',
      reference: 'Acte Uniforme OHADA sur le Droit Commercial, Art. 78',
    })
  }

  // 3. Transactions de montant zéro
  const zeroMontant = tx.filter(t => t.montant === 0 || t.montant == null)
  if (zeroMontant.length > 0) {
    anomalies.push({
      id: uid('compta'), domain: 'comptable', code: 'C003',
      titre: 'Écritures à montant zéro ou nul',
      description: `${zeroMontant.length} écriture(s) avec montant nul détectée(s).`,
      niveau: 'warning',
      impact: 'Écritures parasites qui faussent la balance comptable.',
      recommandation: 'Supprimez ou corrigez ces écritures.',
      valeur: zeroMontant.length,
    })
  }

  // 4. Volume de transactions (activité normale)
  if (tx.length === 0) {
    anomalies.push({
      id: uid('compta'), domain: 'comptable', code: 'C004',
      titre: 'Aucune écriture comptable sur 90 jours',
      description: 'Aucune transaction enregistrée sur les 3 derniers mois.',
      niveau: 'error',
      impact: 'Absence de suivi comptable — risque de non-conformité grave.',
      recommandation: 'Commencez à enregistrer toutes vos opérations dans le module Trésorerie.',
      reference: 'SYSCOHADA révisé, Art. 8 — Obligation de tenir une comptabilité régulière.',
    })
  }

  // 5. Factures sans TVA (Congo)
  const sansStatut = factures.filter(f => !f.statut)
  if (sansStatut.length > 3) {
    anomalies.push({
      id: uid('compta'), domain: 'comptable', code: 'C005',
      titre: 'Factures sans statut défini',
      description: `${sansStatut.length} facture(s) sans statut (brouillon/envoyée/payée).`,
      niveau: 'info',
      impact: 'Suivi du recouvrement impossible.',
      recommandation: 'Mettez à jour le statut de chaque facture.',
    })
  }

  return {
    domain:      'comptable',
    label:       'Audit Comptable',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT FINANCIER
// ══════════════════════════════════════════════════════════════════════════════

export async function auditFinancier(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []
  const since30 = daysAgo(30)

  const [txRes, factRes, stockRes] = await Promise.all([
    supabase.from('transactions').select('type, montant, created_at').eq('tenant_id', tenantId).gte('created_at', since30),
    supabase.from('factures').select('statut, total, montant_paye, date_echeance').eq('tenant_id', tenantId).in('statut', ['envoyee', 'retard', 'payee']),
    supabase.from('stock_articles').select('quantite, prix_unitaire, seuil_alerte').eq('tenant_id', tenantId),
  ])

  const tx       = txRes.data ?? []
  const factures  = factRes.data ?? []
  const stock    = stockRes.data ?? []

  const entrees  = tx.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
  const sorties  = tx.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)
  const solde    = entrees - sorties

  const creances    = factures.filter(f => f.statut !== 'payee').reduce((s, f) => s + ((f.total ?? 0) - (f.montant_paye ?? 0)), 0)
  const valeurStock = stock.reduce((s, a) => s + (a.quantite ?? 0) * (a.prix_unitaire ?? 0), 0)

  // Ratios
  const liquidite = entrees > 0 ? solde / sorties : 0
  const dso = entrees > 0 ? (creances / entrees) * 30 : 0 // jours

  // 1. Trésorerie négative
  if (solde < 0) {
    anomalies.push({
      id: uid('fin'), domain: 'financier', code: 'F001',
      titre: 'Trésorerie négative',
      description: `Solde estimé : ${fmt(solde)} FCFA — en zone critique.`,
      niveau: 'critical',
      impact: 'Risque de cessation de paiement imminent.',
      recommandation: 'Accélérez les encaissements, négociez des délais avec vos fournisseurs.',
      valeur: `${fmt(solde)} FCFA`,
    })
  } else if (solde < 500_000) {
    anomalies.push({
      id: uid('fin'), domain: 'financier', code: 'F002',
      titre: 'Trésorerie insuffisante',
      description: `Solde faible : ${fmt(solde)} FCFA — moins d'un mois de charges.`,
      niveau: 'warning',
      impact: 'Difficultés de paiement à court terme.',
      recommandation: 'Constituez une réserve de trésorerie équivalente à 1,5 mois de charges fixes.',
    })
  }

  // 2. DSO élevé (délai client > 45 jours)
  if (dso > 45) {
    anomalies.push({
      id: uid('fin'), domain: 'financier', code: 'F003',
      titre: `Délai de recouvrement élevé (${dso.toFixed(0)} jours)`,
      description: `Vos clients payent en moyenne ${dso.toFixed(0)} jours après la facturation. Norme : < 30 jours.`,
      niveau: 'warning',
      impact: 'Besoin en fonds de roulement alourdi.',
      recommandation: 'Mettez en place des relances automatiques dès J+15.',
      valeur: `${dso.toFixed(0)} jours`,
      reference: 'Acte Uniforme OHADA sur le Droit Commercial, Art. 65',
    })
  }

  // 3. Créances élevées vs CA
  if (entrees > 0 && creances / entrees > 0.5) {
    anomalies.push({
      id: uid('fin'), domain: 'financier', code: 'F004',
      titre: 'Trop de créances clients non encaissées',
      description: `${fmt(creances)} FCFA impayés — soit ${((creances / entrees) * 100).toFixed(0)}% du CA mensuel.`,
      niveau: 'warning',
      impact: 'Risque de liquidité. Argent "bloqué" chez les clients.',
      recommandation: 'Lancez une campagne de recouvrement prioritaire.',
      valeur: `${fmt(creances)} FCFA`,
    })
  }

  // 4. Aucun chiffre d'affaires
  if (entrees === 0) {
    anomalies.push({
      id: uid('fin'), domain: 'financier', code: 'F005',
      titre: 'Aucun encaissement sur 30 jours',
      description: 'Aucune entrée de trésorerie enregistrée ce mois.',
      niveau: 'error',
      impact: 'Continuité d\'exploitation en question.',
      recommandation: 'Vérifiez que vos encaissements sont bien enregistrés dans le module Trésorerie.',
    })
  }

  return {
    domain:      'financier',
    label:       'Audit Financier',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT FISCAL
// ══════════════════════════════════════════════════════════════════════════════

export async function auditFiscal(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []
  const now = new Date()
  const mois = now.getMonth() + 1
  const jour = now.getDate()

  const [factRes, tenantRes] = await Promise.all([
    supabase.from('factures').select('total, tva, statut, created_at').eq('tenant_id', tenantId)
      .gte('created_at', daysAgo(90)),
    supabase.from('tenants').select('pays, tva_numero, rccm, nif').eq('id', tenantId).maybeSingle(),
  ])

  const factures = factRes.data ?? []
  const tenant   = tenantRes.data

  // 1. NIF manquant
  if (!tenant?.nif) {
    anomalies.push({
      id: uid('fisc'), domain: 'fiscal', code: 'T001',
      titre: 'NIF (Numéro d\'Identification Fiscale) non renseigné',
      description: 'Le NIF n\'est pas enregistré dans les paramètres de l\'entreprise.',
      niveau: 'critical',
      impact: 'Toutes les factures émises sont invalides sans NIF. Risque de redressement fiscal.',
      recommandation: 'Renseignez votre NIF dans Paramètres → Entreprise.',
      reference: 'Code Général des Impôts Congo, Art. 1103',
    })
  }

  // 2. RCCM manquant
  if (!tenant?.rccm) {
    anomalies.push({
      id: uid('fisc'), domain: 'fiscal', code: 'T002',
      titre: 'RCCM non renseigné',
      description: 'Le numéro RCCM n\'est pas enregistré.',
      niveau: 'error',
      impact: 'Mention obligatoire sur les factures OHADA. Vos factures actuelles sont potentiellement invalides.',
      recommandation: 'Renseignez votre RCCM dans Paramètres → Entreprise.',
      reference: 'Acte Uniforme OHADA sur le Droit Commercial, Art. 35',
    })
  }

  // 3. TVA déclaration trimestrielle — Congo
  const moisTVA = [1, 4, 7, 10]
  if (moisTVA.includes(mois) && jour > 15) {
    const tvaCollectee = factures.reduce((s, f) => s + (f.tva ?? 0), 0)
    anomalies.push({
      id: uid('fisc'), domain: 'fiscal', code: 'T003',
      titre: 'Déclaration TVA trimestrielle potentiellement en retard',
      description: `Nous sommes le ${jour}/${mois}. La déclaration TVA était due avant le 15. TVA collectée estimée : ${fmt(tvaCollectee)} FCFA.`,
      niveau: jour > 20 ? 'critical' : 'warning',
      impact: 'Pénalités de retard (10% + 2% par mois) si déclaration non déposée.',
      recommandation: 'Déposez immédiatement votre déclaration TVA trimestrielle à la DGI.',
      reference: 'Code Général des Impôts Congo, Art. 232',
    })
  }

  // 4. Factures sans TVA calculée
  const sansTV = factures.filter(f => !f.tva && (f.total ?? 0) > 0)
  if (sansTV.length > 0) {
    anomalies.push({
      id: uid('fisc'), domain: 'fiscal', code: 'T004',
      titre: `${sansTV.length} facture(s) sans TVA calculée`,
      description: 'Des factures n\'ont pas de TVA renseignée.',
      niveau: 'warning',
      impact: 'Sous-déclaration TVA possible → risque de redressement fiscal.',
      recommandation: 'Vérifiez que la TVA (18% + CA 5%) est bien calculée sur chaque facture.',
      valeur: sansTV.length,
      reference: 'CGI Congo, Art. 191 — TVA 18% + Centime Additionnel 5%',
    })
  }

  // 5. Aucune facture émise
  if (factures.length === 0) {
    anomalies.push({
      id: uid('fisc'), domain: 'fiscal', code: 'T005',
      titre: 'Aucune facture émise sur 90 jours',
      description: 'Aucune activité de facturation enregistrée.',
      niveau: 'warning',
      impact: 'Absence de traçabilité pour les déclarations fiscales.',
      recommandation: 'Utilisez le module Facturation pour enregistrer toutes vos ventes.',
    })
  }

  return {
    domain:      'fiscal',
    label:       'Audit Fiscal',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT RH / SOCIAL
// ══════════════════════════════════════════════════════════════════════════════

export async function auditRH(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []
  const todayStr = today()

  const empRes = await supabase.from('employes')
    .select('id, prenom, nom, type_contrat, statut, date_debut, date_fin_contrat, salaire_brut, cnss_numero')
    .eq('tenant_id', tenantId)

  const employes = empRes.data ?? []
  const actifs   = employes.filter(e => e.statut === 'actif')

  // 1. CDD expirés toujours actifs
  const cddExpires = actifs.filter(e =>
    e.type_contrat === 'CDD' && e.date_fin_contrat && e.date_fin_contrat < todayStr
  )
  if (cddExpires.length > 0) {
    anomalies.push({
      id: uid('rh'), domain: 'rh', code: 'RH001',
      titre: `${cddExpires.length} CDD expiré(s) toujours actif(s)`,
      description: `Employés concernés : ${cddExpires.slice(0, 3).map(e => `${e.prenom} ${e.nom}`).join(', ')}.`,
      niveau: 'critical',
      impact: 'Risque juridique grave — requalification en CDI possible. Cotisations CNSS non conformes.',
      recommandation: 'Régularisez immédiatement : renouvellement CDD, conversion CDI, ou fin de contrat formelle.',
      reference: 'Code du Travail Congo 2023, Art. 42 — Durée maximale CDD',
    })
  }

  // 2. Employés sans numéro CNSS
  const sansCNSS = actifs.filter(e => !e.cnss_numero)
  if (sansCNSS.length > 0) {
    anomalies.push({
      id: uid('rh'), domain: 'rh', code: 'RH002',
      titre: `${sansCNSS.length} employé(s) sans numéro CNSS`,
      description: `Employés non immatriculés CNSS : ${sansCNSS.slice(0, 3).map(e => `${e.prenom} ${e.nom}`).join(', ')}.`,
      niveau: 'critical',
      impact: 'Infraction à la législation sociale — amendes CNSS + redressement des cotisations arriérées.',
      recommandation: 'Immatriculez ces employés à la CNSS immédiatement.',
      reference: 'Loi n°007-2021 sur la Sécurité Sociale, Art. 12',
    })
  }

  // 3. Salaires trop bas (SMIG Congo 90 000 FCFA)
  const sousSMIG = actifs.filter(e => e.salaire_brut && e.salaire_brut < 90_000)
  if (sousSMIG.length > 0) {
    anomalies.push({
      id: uid('rh'), domain: 'rh', code: 'RH003',
      titre: `${sousSMIG.length} employé(s) sous le SMIG (90 000 FCFA)`,
      description: `SMIG 2024 : 90 000 FCFA/mois. ${sousSMIG.slice(0, 3).map(e => `${e.prenom} ${e.nom} (${fmt(e.salaire_brut)} FCFA)`).join(', ')}.`,
      niveau: 'error',
      impact: 'Infraction au Code du Travail — passible de sanctions pénales.',
      recommandation: 'Alignez immédiatement ces salaires sur le SMIG légal.',
      reference: 'Arrêté n°5573/MEFP-MTEPS du 27/09/2023 — SMIG 90 000 FCFA',
    })
  }

  // 4. Aucun employé enregistré
  if (actifs.length === 0 && employes.length === 0) {
    anomalies.push({
      id: uid('rh'), domain: 'rh', code: 'RH004',
      titre: 'Aucun employé enregistré',
      description: 'Le module RH ne contient aucun employé.',
      niveau: 'info',
      impact: 'Impossible de vérifier la conformité sociale sans données RH.',
      recommandation: 'Enregistrez vos employés dans le module RH pour activer l\'audit social.',
    })
  }

  // 5. CDD sans date de fin
  const cddSansDate = actifs.filter(e => e.type_contrat === 'CDD' && !e.date_fin_contrat)
  if (cddSansDate.length > 0) {
    anomalies.push({
      id: uid('rh'), domain: 'rh', code: 'RH005',
      titre: `${cddSansDate.length} CDD sans date d'échéance`,
      description: 'Un CDD doit obligatoirement avoir une date de fin.',
      niveau: 'warning',
      impact: 'Requalification automatique en CDI si aucune date de fin.',
      recommandation: 'Renseignez la date de fin pour tous les CDD.',
      reference: 'Code du Travail Congo, Art. 37 — Mentions obligatoires du CDD',
    })
  }

  return {
    domain:      'rh',
    label:       'Audit RH & Social',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTRÔLE INTERNE
// ══════════════════════════════════════════════════════════════════════════════

export async function auditControleInterne(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []

  const [rolesRes, profilesRes] = await Promise.all([
    supabase.from('role_permissions').select('module_key, can_edit, can_delete, can_validate, can_approve').eq('tenant_id', tenantId),
    supabase.from('profiles').select('id, role, dynamic_role_id').eq('tenant_id', tenantId),
  ])

  const roles    = rolesRes.data ?? []
  const profiles = profilesRes.data ?? []

  const owners = profiles.filter(p => p.role === 'owner')
  const admins = profiles.filter(p => p.role === 'admin')
  const total  = profiles.length

  // 1. Trop d'administrateurs
  if (admins.length > 3 && total > 0 && admins.length / total > 0.5) {
    anomalies.push({
      id: uid('ci'), domain: 'controle_interne', code: 'CI001',
      titre: 'Trop d\'utilisateurs avec droits Administrateur',
      description: `${admins.length} admin(s) sur ${total} utilisateurs — soit ${((admins.length / total) * 100).toFixed(0)}%.`,
      niveau: 'warning',
      impact: 'Risque fraude interne. Principe de moindre privilège non respecté.',
      recommandation: 'Limitez les droits admin aux seules personnes nécessaires. Créez des rôles spécifiques.',
    })
  }

  // 2. Absence de séparation des tâches (si 1 seul utilisateur fait tout)
  if (total === 1) {
    anomalies.push({
      id: uid('ci'), domain: 'controle_interne', code: 'CI002',
      titre: 'Absence de séparation des tâches',
      description: 'Un seul utilisateur a accès à tous les modules. Risque élevé de fraude non détectée.',
      niveau: 'warning',
      impact: 'Principe fondamental du contrôle interne non respecté.',
      recommandation: 'Créez au moins 2 utilisateurs avec des rôles différents (ex: comptable + caissier).',
    })
  }

  // 3. Modules sans restriction de validation
  const sansValidation = roles.filter(r => r.can_edit && !r.can_validate && !r.can_approve)
  if (sansValidation.length > 3) {
    anomalies.push({
      id: uid('ci'), domain: 'controle_interne', code: 'CI003',
      titre: `${sansValidation.length} modules sans workflow de validation`,
      description: 'Des modifications peuvent être effectuées sans validation hiérarchique.',
      niveau: 'info',
      impact: 'Risque d\'erreurs ou de fraudes non détectées.',
      recommandation: 'Activez les workflows de validation dans le module Workflows.',
    })
  }

  // 4. Absence totale de rôles personnalisés
  const customRoles = profiles.filter(p => p.dynamic_role_id)
  if (total > 3 && customRoles.length === 0) {
    anomalies.push({
      id: uid('ci'), domain: 'controle_interne', code: 'CI004',
      titre: 'Aucun rôle personnalisé configuré',
      description: `${total} utilisateurs, tous avec des rôles génériques (owner/admin/user).`,
      niveau: 'info',
      impact: 'Contrôle fin des accès impossible avec des rôles génériques.',
      recommandation: 'Créez des rôles métier dans le module Rôles & Droits (ex: Comptable, Caissier, Auditeur).',
    })
  }

  return {
    domain:      'controle_interne',
    label:       'Contrôle Interne',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFORMITÉ OHADA
// ══════════════════════════════════════════════════════════════════════════════

export async function auditOHADA(supabase: SupabaseClient, tenantId: string): Promise<AuditScore> {
  const anomalies: AuditAnomalie[] = []

  const tenantRes = await supabase.from('tenants').select('nif, rccm, pays, tva_numero, nom_entreprise, forme_juridique').eq('id', tenantId).maybeSingle()
  const tenant = tenantRes.data

  // 1. NIF manquant — CRITIQUE
  if (!tenant?.nif) {
    anomalies.push({
      id: uid('ohada'), domain: 'ohada', code: 'OH001',
      titre: 'NIF absent — Obligation légale',
      description: 'Le Numéro d\'Identification Fiscale est obligatoire sur tout document commercial.',
      niveau: 'critical', impact: 'Toutes les factures émises sont sans valeur légale.',
      recommandation: 'Renseignez le NIF immédiatement dans Paramètres.',
      reference: 'SYSCOHADA révisé — Art. 8 & CGI Congo Art. 1103',
    })
  }

  // 2. RCCM manquant
  if (!tenant?.rccm) {
    anomalies.push({
      id: uid('ohada'), domain: 'ohada', code: 'OH002',
      titre: 'RCCM absent — Mention obligatoire OHADA',
      description: 'Le Registre du Commerce et du Crédit Mobilier doit figurer sur toutes les factures.',
      niveau: 'error', impact: 'Non-conformité Acte Uniforme OHADA sur le Droit Commercial.',
      recommandation: 'Renseignez le RCCM dans Paramètres → Entreprise.',
      reference: 'Acte Uniforme OHADA sur le Droit Commercial, Art. 35',
    })
  }

  // 3. Forme juridique
  if (!tenant?.forme_juridique) {
    anomalies.push({
      id: uid('ohada'), domain: 'ohada', code: 'OH003',
      titre: 'Forme juridique non renseignée',
      description: 'La forme juridique (SARL, SA, ETS...) est obligatoire sur les documents commerciaux.',
      niveau: 'warning', impact: 'Documents commerciaux incomplets.',
      recommandation: 'Renseignez la forme juridique dans Paramètres.',
      reference: 'Acte Uniforme OHADA sur les Sociétés Commerciales, Art. 215',
    })
  }

  // 4. Plan comptable SYSCOHADA
  const [txRes] = await Promise.all([
    supabase.from('transactions').select('reference, compte_comptable').eq('tenant_id', tenantId).limit(10),
  ])
  const txWithCompte = (txRes.data ?? []).filter(t => t.compte_comptable)
  if (txWithCompte.length === 0) {
    anomalies.push({
      id: uid('ohada'), domain: 'ohada', code: 'OH004',
      titre: 'Comptes SYSCOHADA non utilisés',
      description: 'Aucune écriture n\'utilise les codes comptes du plan SYSCOHADA.',
      niveau: 'warning', impact: 'Comptabilité non conforme au plan OHADA.',
      recommandation: 'Activez le mode Plan Comptable SYSCOHADA dans les paramètres comptabilité.',
      reference: 'SYSCOHADA révisé — Classes 1 à 9',
    })
  }

  // 5. Pays OHADA — vérification membre
  const paysOHADA = ['CG','CD','CM','CI','SN','ML','BF','GN','GA','GQ','TD','CF','NE','BJ','TG','MG','KM','BI','RW','GW']
  if (tenant?.pays && !paysOHADA.includes(tenant.pays)) {
    anomalies.push({
      id: uid('ohada'), domain: 'ohada', code: 'OH005',
      titre: 'Pays non membre OHADA',
      description: `Le pays configuré (${tenant.pays}) n'est pas un État membre de l'OHADA.`,
      niveau: 'info', impact: 'Les règles SYSCOHADA ne s\'appliquent peut-être pas.',
      recommandation: 'Vérifiez votre configuration pays et adaptez le plan comptable à votre législation.',
    })
  }

  return {
    domain:      'ohada',
    label:       'Conformité OHADA',
    score:       penalise(100, anomalies),
    anomalies,
    computed_at: new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT GLOBAL — agrège tous les scores
// ══════════════════════════════════════════════════════════════════════════════

export async function runAuditGlobal(supabase: SupabaseClient, tenantId: string): Promise<AuditGlobal> {
  _id = 0 // reset IDs

  const [comptable, financier, fiscal, rh, controle, ohada] = await Promise.all([
    auditComptable(supabase, tenantId),
    auditFinancier(supabase, tenantId),
    auditFiscal(supabase, tenantId),
    auditRH(supabase, tenantId),
    auditControleInterne(supabase, tenantId),
    auditOHADA(supabase, tenantId),
  ])

  const scores = [comptable.score, financier.score, fiscal.score, rh.score, controle.score, ohada.score]
  const score_global = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)

  const all_anomalies = [
    ...comptable.anomalies,
    ...financier.anomalies,
    ...fiscal.anomalies,
    ...rh.anomalies,
    ...controle.anomalies,
    ...ohada.anomalies,
  ]

  const nb_critiques = all_anomalies.filter(a => a.niveau === 'critical').length

  return {
    score_global,
    score_comptable:  comptable.score,
    score_financier:  financier.score,
    score_fiscal:     fiscal.score,
    score_rh:         rh.score,
    score_controle:   controle.score,
    score_ohada:      ohada.score,
    nb_anomalies:     all_anomalies.length,
    nb_critiques,
    nb_actions:       all_anomalies.length,
    anomalies:        all_anomalies,
    computed_at:      new Date().toISOString(),
  }
}

// ── Sauvegarder les résultats ─────────────────────────────────────────────────

export async function sauvegarderAudit(
  supabase: SupabaseClient,
  tenantId: string,
  audit: AuditGlobal
): Promise<void> {
  try {
    await supabase.from('audit_scores').upsert({
      tenant_id:       tenantId,
      score_global:    audit.score_global,
      score_comptable: audit.score_comptable,
      score_financier: audit.score_financier,
      score_fiscal:    audit.score_fiscal,
      score_rh:        audit.score_rh,
      score_controle:  audit.score_controle,
      score_ohada:     audit.score_ohada,
      nb_anomalies:    audit.nb_anomalies,
      nb_critiques:    audit.nb_critiques,
      computed_at:     audit.computed_at,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'tenant_id' })

    if (audit.anomalies.length > 0) {
      await supabase.from('audit_anomalies').delete().eq('tenant_id', tenantId)
      await supabase.from('audit_anomalies').insert(
        audit.anomalies.map(a => ({ ...a, tenant_id: tenantId, resolu: false, created_at: audit.computed_at }))
      )
    }
  } catch { /* non-bloquant */ }
}
