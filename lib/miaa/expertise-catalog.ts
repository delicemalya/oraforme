/**
 * lib/miaa/expertise-catalog.ts
 * Catalogue MIAA+ Marketplace d'Expertise
 * 10 catégories × 82 types de documents professionnels
 */
import type { PaysData } from './pays-localization'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InputField {
  id:           string
  label:        string
  type:         'text' | 'select' | 'number' | 'date' | 'textarea'
  placeholder?: string
  options?:     string[]
  required?:    boolean
  defaultValue?: string
}

export interface DocContext {
  pays:       string
  paysConfig: PaysData
  entreprise: string
  secteur:    string
  inputs:     Record<string, string>
  date:       string
}

export interface ExpertiseDoc {
  id:           string
  categorie:    string
  label:        string
  description:  string
  icon:         string
  complexity:   'rapide' | 'standard' | 'complet'
  inputs:       InputField[]
  buildPrompt:  (ctx: DocContext) => string
}

export interface ExpertiseCat {
  id:          string
  label:       string
  icon:        string
  color:       string
  bgColor:     string
  border:      string
  description: string
}

// ── Catégories ─────────────────────────────────────────────────────────────────

export const EXPERTISE_CATEGORIES: ExpertiseCat[] = [
  { id: 'ohada',      label: 'Modèles OHADA',       icon: '📊', color: '#6366F1', bgColor: '#EEF2FF', border: '#C7D2FE', description: 'Documents comptables SYSCOHADA' },
  { id: 'contrats',   label: 'Contrats & Juridique', icon: '⚖️', color: '#DC2626', bgColor: '#FEF2F2', border: '#FECACA', description: 'Contrats travail & commerciaux' },
  { id: 'rh',         label: 'RH & Procédures',      icon: '👥', color: '#7C3AED', bgColor: '#F5F3FF', border: '#DDD6FE', description: 'Manuel RH, fiches de poste' },
  { id: 'audit',      label: 'Audit & Conformité',   icon: '🛡️', color: '#DC2626', bgColor: '#FEF2F2', border: '#FECACA', description: 'Plans audit, matrices risques' },
  { id: 'fiscalite',  label: 'Fiscalité',             icon: '🏛️', color: '#B45309', bgColor: '#FFFBEB', border: '#FDE68A', description: 'Déclarations & calendrier fiscal' },
  { id: 'qualite',    label: 'Qualité & ISO',         icon: '✅', color: '#16A34A', bgColor: '#F0FDF4', border: '#BBF7D0', description: 'Manuel qualité, processus ISO' },
  { id: 'business',   label: 'Business Plan',         icon: '💼', color: '#0369A1', bgColor: '#F0F9FF', border: '#BAE6FD', description: 'Business plan, prévisionnel' },
  { id: 'rapports',   label: 'Rapports Exécutifs',    icon: '📈', color: '#0F766E', bgColor: '#F0FDFA', border: '#99F6E4', description: 'Rapports DG, financiers, CA' },
  { id: 'tableaux',   label: 'Tableaux de Bord',      icon: '📉', color: '#9333EA', bgColor: '#FAF5FF', border: '#E9D5FF', description: 'KPIs, dashboards, prévisions' },
  { id: 'bibliotheque', label: 'Bibliothèque',        icon: '📚', color: '#374151', bgColor: '#F9FAFB', border: '#E5E7EB', description: 'Tous vos documents générés' },
]

// ── Utilitaire prompt ──────────────────────────────────────────────────────────

function paysHeader(ctx: DocContext): string {
  const p = ctx.paysConfig
  return `CONTEXTE LÉGAL ET FISCAL
Pays : ${ctx.pays} | Cadre légal : ${p.cadre_legal}
Devise : ${p.devise} | TVA : ${p.tva}%${p.tva_note ? ' ' + p.tva_note : ''} | IS : ${p.is}%
CNSS salarial : ${p.cnss_salarial}% | CNSS patronal : ${p.cnss_patronal}%
${p.notes_fiscales}
${p.notes_sociales}
Tribunal compétent : ${p.tribunal}`
}

function entrepriseHeader(ctx: DocContext): string {
  return `ENTREPRISE : ${ctx.entreprise} | Secteur : ${ctx.secteur} | Date : ${ctx.date}`
}

const BASE = `Tu es MIAA+, expert-comptable, juriste et consultant certifié OHADA.
Génère un document professionnel complet, prêt à l'usage. Structure claire avec articles numérotés, titres, signatures et mentions légales. Texte sans markdown, formaté pour l'impression.`

// ── Documents OHADA ────────────────────────────────────────────────────────────

const OHADA_DOCS: ExpertiseDoc[] = [
  {
    id: 'plan-comptable',
    categorie: 'ohada',
    label: 'Plan Comptable OHADA',
    description: 'Plan comptable adapté SYSCOHADA Révisé 2017 pour votre secteur',
    icon: '📊',
    complexity: 'standard',
    inputs: [
      { id: 'exercice', label: 'Exercice comptable', type: 'text', placeholder: '2024', required: true },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || new Date().getFullYear()}

MISSION : Génère le plan comptable SYSCOHADA Révisé 2017 adapté au secteur ${ctx.secteur}.
Inclure : classes 1 à 8 avec les comptes les plus utilisés dans ce secteur, numérotation OHADA standard, intitulés complets, nature (bilan/résultat), sens normal (débit/crédit).
Format : tableau structuré — Numéro | Intitulé du compte | Classe | Nature | Sens normal`,
  },
  {
    id: 'journal-comptable',
    categorie: 'ohada',
    label: 'Journal Comptable',
    description: 'Modèle de journal comptable mensuel OHADA',
    icon: '📒',
    complexity: 'rapide',
    inputs: [
      { id: 'mois', label: 'Mois / Période', type: 'text', placeholder: 'Janvier 2024', required: true },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.mois}

MISSION : Génère un modèle de journal comptable général OHADA pour la période ${ctx.inputs.mois}.
Inclure : en-tête officiel, colonnes (Date | Pièce | Libellé | Compte | Débit | Crédit), exemples d'écritures courantes pour ${ctx.secteur}, totaux colonnes, visa comptable.`,
  },
  {
    id: 'grand-livre',
    categorie: 'ohada',
    label: 'Grand Livre',
    description: 'Grand livre par compte SYSCOHADA',
    icon: '📓',
    complexity: 'rapide',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2024' },
      { id: 'compte', label: 'Compte(s) concerné(s)', type: 'text', placeholder: 'Ex: 411 - Clients' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère le modèle de grand livre OHADA ${ctx.inputs.compte ? `pour le compte ${ctx.inputs.compte}` : 'type'}, exercice ${ctx.inputs.exercice || '2024'}.
Inclure : en-tête (entreprise, exercice, compte), colonnes (Date | Référence | Libellé | Débit | Crédit | Solde), solde d'ouverture, exemples d'écritures, report solde.`,
  },
  {
    id: 'balance-generale',
    categorie: 'ohada',
    label: 'Balance Générale',
    description: 'Balance des comptes SYSCOHADA au format officiel',
    icon: '⚖️',
    complexity: 'standard',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2024' },
      { id: 'date_arrete', label: "Date d'arrêté", type: 'text', placeholder: '31/12/2024' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || '2024'} | Arrêté au : ${ctx.inputs.date_arrete || '31/12/2024'}

MISSION : Génère un modèle de balance générale OHADA SYSCOHADA Révisé.
Inclure : en-tête officiel, colonnes (N° Compte | Intitulé | Mvts Débit | Mvts Crédit | Solde Débiteur | Solde Créditeur), les principales classes 1-8, totaux et cadrage, signatures Direction et Expert-Comptable.`,
  },
  {
    id: 'bilan-ohada',
    categorie: 'ohada',
    label: 'Bilan OHADA',
    description: "Bilan SYSCOHADA — Actif/Passif format officiel",
    icon: '📋',
    complexity: 'complet',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2024' },
      { id: 'capital', label: 'Capital social (FCFA)', type: 'number', placeholder: '10000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || '2024'} | Capital : ${ctx.inputs.capital || 'N/C'} ${ctx.paysConfig.devise}

MISSION : Génère le modèle de bilan SYSCOHADA Révisé 2017 complet.
ACTIF : Actif immobilisé (immob. incorporelles, corporelles, financières) + Actif circulant (stocks, créances, trésorerie) + Écarts de conversion actif.
PASSIF : Capitaux propres + Dettes financières + Passif circulant (fournisseurs, fiscales, sociales) + Trésorerie passif.
Format tableau officiel avec colonnes N-1 et N. Inclure les notes de bas de tableau.`,
  },
  {
    id: 'compte-resultat',
    categorie: 'ohada',
    label: 'Compte de Résultat',
    description: 'Compte de résultat SYSCOHADA par nature',
    icon: '📈',
    complexity: 'complet',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2024' },
      { id: 'ca', label: 'Chiffre d\'affaires estimé', type: 'number', placeholder: '50000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || '2024'} | CA : ${ctx.inputs.ca || 'N/C'} ${ctx.paysConfig.devise}

MISSION : Génère le compte de résultat SYSCOHADA Révisé par nature — format officiel.
Inclure : Produits d'exploitation (Ventes, Variation stocks, Production immobilisée) + Charges d'exploitation (Achats, Charges externes, Personnel, Dotations) + Résultat d'exploitation + Résultat financier + Résultat HAO + IS + Résultat net.
Colonnes N et N-1. IS ${ctx.paysConfig.is}%. Calcul de la Valeur Ajoutée, EBE, CAF.`,
  },
  {
    id: 'annexes-ohada',
    categorie: 'ohada',
    label: 'Annexes OHADA',
    description: 'Annexes des états financiers SYSCOHADA',
    icon: '📎',
    complexity: 'complet',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2024' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || '2024'}

MISSION : Génère le modèle d'annexes des états financiers SYSCOHADA Révisé 2017.
Inclure : Note 1 Faits significatifs, Note 2 Méthodes comptables, Note 3 Immobilisations, Note 4 Stocks, Note 5 Créances, Note 6 Dettes financières, Note 7 Capitaux propres, Note 8 Engagements hors bilan, Note 9 Personnel, Note 10 Événements postérieurs.`,
  },
  {
    id: 'procedures-comptables',
    categorie: 'ohada',
    label: 'Procédures Comptables',
    description: 'Manuel des procédures comptables OHADA',
    icon: '📝',
    complexity: 'standard',
    inputs: [
      { id: 'services', label: 'Services concernés', type: 'text', placeholder: 'Comptabilité, Finance, DG' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Services : ${ctx.inputs.services || 'Comptabilité, Finance'}

MISSION : Génère le manuel des procédures comptables OHADA pour ${ctx.entreprise}.
Inclure : Procédure achats/fournisseurs, Procédure ventes/clients, Procédure trésorerie, Procédure paie, Procédure TVA, Clôture mensuelle, Clôture annuelle. Chaque procédure : objectif, responsable, étapes numérotées, contrôles, documents supports.`,
  },
  {
    id: 'manuel-comptable',
    categorie: 'ohada',
    label: 'Manuel Comptable',
    description: "Manuel comptable interne OHADA de l'entreprise",
    icon: '📘',
    complexity: 'complet',
    inputs: [
      { id: 'dg', label: 'Nom du Directeur Général', type: 'text', placeholder: 'M. Jean DUPONT' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | DG : ${ctx.inputs.dg || 'Direction Générale'}

MISSION : Génère le manuel comptable complet de ${ctx.entreprise} conformément au SYSCOHADA Révisé 2017.
Chapitres : 1. Organisation comptable, 2. Plan de comptes spécifique, 3. Règles d'évaluation, 4. Procédures de clôture, 5. Contrôles internes, 6. Documents obligatoires, 7. Conservation des archives. Signature du DG et Expert-Comptable.`,
  },
  {
    id: 'guide-ohada',
    categorie: 'ohada',
    label: 'Guide OHADA Pratique',
    description: 'Guide pratique des obligations OHADA pour PME',
    icon: '📖',
    complexity: 'standard',
    inputs: [],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un guide pratique OHADA pour ${ctx.secteur} en ${ctx.pays}.
Inclure : 1. Obligations de tenue de comptabilité, 2. États financiers obligatoires, 3. Délais de dépôt, 4. Sanctions en cas de manquement, 5. Nouveautés SYSCOHADA Révisé 2017, 6. FAQ pratique, 7. Contacts DGI ${ctx.pays}.`,
  },
]

// ── Documents Contrats & Juridique ─────────────────────────────────────────────

const CONTRATS_DOCS: ExpertiseDoc[] = [
  {
    id: 'contrat-cdd',
    categorie: 'contrats',
    label: 'Contrat CDD',
    description: 'Contrat à Durée Déterminée conforme au droit local',
    icon: '📋',
    complexity: 'standard',
    inputs: [
      { id: 'nom_employe', label: 'Nom & Prénom employé', type: 'text', placeholder: 'MABIALA Jean', required: true },
      { id: 'fonction', label: 'Fonction / Poste', type: 'text', placeholder: 'Comptable', required: true },
      { id: 'salaire', label: `Salaire brut mensuel`, type: 'number', placeholder: '300000', required: true },
      { id: 'duree', label: 'Durée du contrat', type: 'text', placeholder: '6 mois', required: true },
      { id: 'date_debut', label: 'Date de début', type: 'text', placeholder: '01/01/2025' },
      { id: 'motif', label: 'Motif du CDD', type: 'text', placeholder: 'Accroissement temporaire activité' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un Contrat à Durée Déterminée (CDD) conforme au ${ctx.paysConfig.code_travail}.

PARTIES :
- Employeur : ${ctx.entreprise} (secteur ${ctx.secteur})
- Salarié : ${ctx.inputs.nom_employe} | Poste : ${ctx.inputs.fonction}
- Salaire brut : ${ctx.inputs.salaire} ${ctx.paysConfig.devise}/mois | Net estimé : ${Math.round(Number(ctx.inputs.salaire) * (1 - ctx.paysConfig.cnss_salarial / 100))} ${ctx.paysConfig.devise}
- Durée : ${ctx.inputs.duree} à partir du ${ctx.inputs.date_debut || '___/___/______'}
- Motif : ${ctx.inputs.motif || 'À préciser'}

Inclure : identification parties, poste et missions, rémunération (brut + déductions CNSS ${ctx.paysConfig.cnss_salarial}%), durée et renouvellement, obligations des parties, congés, clause de confidentialité, résiliation, droit applicable (${ctx.pays}), signatures et date.`,
  },
  {
    id: 'contrat-cdi',
    categorie: 'contrats',
    label: 'Contrat CDI',
    description: 'Contrat à Durée Indéterminée droit local',
    icon: '📋',
    complexity: 'standard',
    inputs: [
      { id: 'nom_employe', label: 'Nom & Prénom employé', type: 'text', placeholder: 'MABIALA Jean', required: true },
      { id: 'fonction', label: 'Fonction / Poste', type: 'text', placeholder: 'Directeur Financier', required: true },
      { id: 'salaire', label: 'Salaire brut mensuel', type: 'number', placeholder: '500000', required: true },
      { id: 'date_debut', label: 'Date de début', type: 'text', placeholder: '01/01/2025' },
      { id: 'periode_essai', label: "Période d'essai", type: 'text', placeholder: '3 mois' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un Contrat à Durée Indéterminée (CDI) conforme au ${ctx.paysConfig.code_travail}.
Salarié : ${ctx.inputs.nom_employe} | Poste : ${ctx.inputs.fonction}
Salaire brut : ${ctx.inputs.salaire} ${ctx.paysConfig.devise} | CNSS salarial : ${ctx.paysConfig.cnss_salarial}%
Date début : ${ctx.inputs.date_debut || '___'} | Période d'essai : ${ctx.inputs.periode_essai || '3 mois'}

Inclure tous articles obligatoires : identification, poste et description de mission, rémunération et avantages, horaires, période d'essai, congés annuels, formation, clause de non-concurrence, confidentialité, résiliation et préavis, droit applicable.`,
  },
  {
    id: 'contrat-stage',
    categorie: 'contrats',
    label: 'Convention de Stage',
    description: 'Convention tripartite entreprise/stagiaire/école',
    icon: '🎓',
    complexity: 'rapide',
    inputs: [
      { id: 'stagiaire', label: 'Nom du stagiaire', type: 'text', placeholder: 'NGUYEN Marie', required: true },
      { id: 'ecole', label: 'Établissement scolaire', type: 'text', placeholder: 'IAM Brazzaville', required: true },
      { id: 'duree', label: 'Durée', type: 'text', placeholder: '3 mois', required: true },
      { id: 'mission', label: 'Mission principale', type: 'text', placeholder: 'Assistance comptabilité' },
      { id: 'gratification', label: 'Gratification mensuelle', type: 'number', placeholder: '50000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère une convention de stage tripartite.
Stagiaire : ${ctx.inputs.stagiaire} | École : ${ctx.inputs.ecole}
Durée : ${ctx.inputs.duree} | Mission : ${ctx.inputs.mission || 'À définir'}
Gratification : ${ctx.inputs.gratification || '0'} ${ctx.paysConfig.devise}/mois

Inclure : parties, objet, durée, missions, tuteur entreprise, conditions accueil, assurance, propriété intellectuelle, gratification, résiliation, signatures des 3 parties.`,
  },
  {
    id: 'contrat-consultant',
    categorie: 'contrats',
    label: 'Contrat Consultant',
    description: 'Contrat de mission freelance / consultant indépendant',
    icon: '🤝',
    complexity: 'standard',
    inputs: [
      { id: 'consultant', label: 'Nom du consultant', type: 'text', placeholder: 'Cabinet ABC', required: true },
      { id: 'mission', label: 'Objet de la mission', type: 'text', placeholder: 'Audit fiscal Q4 2024', required: true },
      { id: 'honoraires', label: 'Honoraires totaux', type: 'number', placeholder: '2000000', required: true },
      { id: 'duree', label: 'Durée de la mission', type: 'text', placeholder: '2 mois' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un contrat de mission de consultant indépendant.
Consultant : ${ctx.inputs.consultant} | Mission : ${ctx.inputs.mission}
Honoraires : ${ctx.inputs.honoraires} ${ctx.paysConfig.devise} | Durée : ${ctx.inputs.duree || 'À définir'}

Articles : identification, objet précis, livrables, honoraires et modalités de paiement, DAS (si applicable en ${ctx.pays}), propriété des travaux, confidentialité, non-concurrence, résiliation, clause pénale, droit applicable, signatures.`,
  },
  {
    id: 'contrat-fournisseur',
    categorie: 'contrats',
    label: 'Contrat Fournisseur',
    description: 'Contrat cadre d\'approvisionnement',
    icon: '🏭',
    complexity: 'standard',
    inputs: [
      { id: 'fournisseur', label: 'Nom du fournisseur', type: 'text', placeholder: 'SOCIETE XYZ', required: true },
      { id: 'produits', label: 'Produits / Services', type: 'text', placeholder: 'Fournitures de bureau', required: true },
      { id: 'montant', label: 'Montant annuel estimé', type: 'number', placeholder: '5000000' },
      { id: 'duree', label: 'Durée du contrat', type: 'text', placeholder: '1 an renouvelable' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un contrat cadre fournisseur.
Acheteur : ${ctx.entreprise} | Fournisseur : ${ctx.inputs.fournisseur}
Produits/Services : ${ctx.inputs.produits} | Montant estimé : ${ctx.inputs.montant || 'N/C'} ${ctx.paysConfig.devise}/an
Durée : ${ctx.inputs.duree || '1 an'}

Articles : identification, objet, commandes et bons de commande, prix et conditions de paiement TVA ${ctx.paysConfig.tva}%, livraison et délais, réception et contrôle qualité, garanties, pénalités de retard, responsabilité, force majeure, résiliation, tribunal ${ctx.paysConfig.tribunal}.`,
  },
  {
    id: 'contrat-client',
    categorie: 'contrats',
    label: 'Contrat Client',
    description: 'Contrat de service / prestation client',
    icon: '🤝',
    complexity: 'standard',
    inputs: [
      { id: 'client', label: 'Nom du client', type: 'text', placeholder: 'CLIENT SA', required: true },
      { id: 'prestation', label: 'Prestation fournie', type: 'text', placeholder: 'Audit comptable annuel', required: true },
      { id: 'montant', label: 'Montant HT', type: 'number', placeholder: '3000000' },
      { id: 'duree', label: 'Durée / Délai livraison', type: 'text', placeholder: '30 jours' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un contrat de prestation de services.
Prestataire : ${ctx.entreprise} | Client : ${ctx.inputs.client}
Prestation : ${ctx.inputs.prestation} | Montant HT : ${ctx.inputs.montant || 'N/C'} ${ctx.paysConfig.devise}
TVA ${ctx.paysConfig.tva}%${ctx.paysConfig.tva_note ? ' + ' + ctx.paysConfig.tva_note : ''} | TTC estimé : ${Math.round(Number(ctx.inputs.montant || 0) * (1 + ctx.paysConfig.tva / 100))} ${ctx.paysConfig.devise}
Délai : ${ctx.inputs.duree || 'À définir'}

Articles : objet, livrables précis, planning, prix et facturation, paiement, propriété intellectuelle, confidentialité, validation client, pénalités, résiliation, litiges.`,
  },
  {
    id: 'pv-ag-ordinaire',
    categorie: 'contrats',
    label: 'PV Assemblée Générale Ordinaire',
    description: 'Procès-verbal d\'AGO conforme OHADA',
    icon: '📜',
    complexity: 'standard',
    inputs: [
      { id: 'date_ag', label: 'Date de l\'AG', type: 'text', placeholder: '30/06/2025', required: true },
      { id: 'ordre_jour', label: 'Ordre du jour', type: 'textarea', placeholder: '1. Approbation comptes\n2. Affectation résultat\n3. Ratification pouvoirs DG' },
      { id: 'capital', label: 'Capital social', type: 'number', placeholder: '10000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un procès-verbal d'Assemblée Générale Ordinaire conforme au droit des sociétés OHADA (AUSCGIE).
Date : ${ctx.inputs.date_ag} | Capital : ${ctx.inputs.capital || 'N/C'} ${ctx.paysConfig.devise}
Ordre du jour : ${ctx.inputs.ordre_jour || 'Approbation des comptes, affectation résultat'}

Structure : convocation légale respectée, ouverture séance, vérification quorum, présidence, secrétaire, ordre du jour, exposé DG, lecture rapports, discussions, résolutions adoptées (vote, résultat), clôture, signatures Président + Secrétaire.`,
  },
  {
    id: 'reglement-interieur',
    categorie: 'contrats',
    label: 'Règlement Intérieur',
    description: 'Règlement intérieur du personnel conforme au droit local',
    icon: '📏',
    complexity: 'complet',
    inputs: [
      { id: 'effectif', label: 'Effectif actuel', type: 'number', placeholder: '25' },
      { id: 'horaires', label: 'Horaires de travail', type: 'text', placeholder: '8h-17h du lundi au vendredi' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Effectif : ${ctx.inputs.effectif || 'N/C'}

MISSION : Génère le règlement intérieur du personnel conforme au ${ctx.paysConfig.code_travail}.
Horaires : ${ctx.inputs.horaires || '8h-17h'}

Chapitres : 1. Objet et champ d'application, 2. Entrée dans l'entreprise, 3. Horaires et temps de travail, 4. Absences et congés, 5. Discipline et sanctions, 6. Hygiène et sécurité, 7. Représentation du personnel, 8. Harcèlement et violence, 9. Usage du matériel, 10. Confidentialité, 11. Sanctions disciplinaires, 12. Dispositions finales. Visa Inspection du Travail.`,
  },
  {
    id: 'statuts-sarl',
    categorie: 'contrats',
    label: 'Statuts SARL / SA',
    description: 'Statuts de société conforme OHADA AUSCGIE',
    icon: '🏢',
    complexity: 'complet',
    inputs: [
      { id: 'type_societe', label: 'Type de société', type: 'select', options: ['SARL', 'SA', 'SAS', 'SNC', 'GIE'], required: true },
      { id: 'capital', label: 'Capital social', type: 'number', placeholder: '1000000', required: true },
      { id: 'associes', label: 'Nombre d\'associés', type: 'number', placeholder: '2' },
      { id: 'siege', label: 'Siège social', type: 'text', placeholder: 'Brazzaville, Congo' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère les statuts d'une ${ctx.inputs.type_societe || 'SARL'} conforme à l'Acte Uniforme OHADA relatif aux Sociétés Commerciales et GIE (AUSCGIE révisé).
Capital : ${ctx.inputs.capital} ${ctx.paysConfig.devise} | Associés : ${ctx.inputs.associes || '2'} | Siège : ${ctx.inputs.siege || ctx.pays}

Articles : Forme, Dénomination, Siège, Objet, Durée, Capital et parts, Gérance/Administration, Décisions collectives, Exercice social, Répartition résultats, Dissolution, Liquidation. Conforme RCCM ${ctx.pays}.`,
  },
]

// ── Documents RH ───────────────────────────────────────────────────────────────

const RH_DOCS: ExpertiseDoc[] = [
  {
    id: 'manuel-rh',
    categorie: 'rh',
    label: 'Manuel RH',
    description: 'Manuel des ressources humaines complet',
    icon: '👥',
    complexity: 'complet',
    inputs: [
      { id: 'effectif', label: 'Effectif', type: 'number', placeholder: '30' },
      { id: 'drh', label: 'Nom du DRH', type: 'text', placeholder: 'Mme NKOUNKOU Claire' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Effectif : ${ctx.inputs.effectif || 'N/C'} | DRH : ${ctx.inputs.drh || 'Direction RH'}

MISSION : Génère le Manuel RH complet de ${ctx.entreprise}.
Chapitres : 1. Politique RH et valeurs, 2. Recrutement et intégration, 3. Rémunérations et avantages, 4. Évaluation des performances, 5. Formation et développement, 6. Congés et absences, 7. Discipline, 8. Hygiène et sécurité, 9. Relations sociales, 10. Départ de l'entreprise. Conforme ${ctx.paysConfig.code_travail}.`,
  },
  {
    id: 'fiche-poste',
    categorie: 'rh',
    label: 'Fiche de Poste',
    description: 'Fiche de poste professionnelle détaillée',
    icon: '📋',
    complexity: 'rapide',
    inputs: [
      { id: 'titre', label: 'Titre du poste', type: 'text', placeholder: 'Responsable Comptable', required: true },
      { id: 'departement', label: 'Département', type: 'text', placeholder: 'Finance & Comptabilité', required: true },
      { id: 'responsable', label: 'Supérieur hiérarchique', type: 'text', placeholder: 'Directeur Financier' },
      { id: 'salaire_fourchette', label: 'Fourchette salariale', type: 'text', placeholder: '400 000 - 600 000 FCFA' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)}

MISSION : Génère une fiche de poste professionnelle complète.
Poste : ${ctx.inputs.titre} | Département : ${ctx.inputs.departement}
N+1 : ${ctx.inputs.responsable || 'N/A'} | Rémunération : ${ctx.inputs.salaire_fourchette || 'selon profil'}

Structure : Identification du poste, Position dans l'organigramme, Missions principales (5-8 missions), Activités et tâches détaillées, Compétences requises (techniques + comportementales), Formation et expérience, Outils utilisés, Conditions de travail, Indicateurs de performance.`,
  },
  {
    id: 'politique-conges',
    categorie: 'rh',
    label: 'Politique Congés',
    description: "Politique et procédure de gestion des congés",
    icon: '🏖️',
    complexity: 'rapide',
    inputs: [],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère la politique de gestion des congés conforme au ${ctx.paysConfig.code_travail}.
Inclure : congés annuels légaux, congés maladie, congés maternité/paternité, congés sans solde, congés exceptionnels (mariage, décès), procédure de demande, délais de prévenance, période de prise des congés, report et paiement en cas de départ.`,
  },
  {
    id: 'processus-recrutement',
    categorie: 'rh',
    label: 'Processus de Recrutement',
    description: 'Guide complet du processus de recrutement',
    icon: '🔍',
    complexity: 'standard',
    inputs: [
      { id: 'types_postes', label: 'Types de postes recrutés', type: 'text', placeholder: 'Cadres, techniciens, opérateurs' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)} | Postes : ${ctx.inputs.types_postes || 'tous niveaux'}

MISSION : Génère le processus de recrutement complet de ${ctx.entreprise}.
Étapes : 1. Identification du besoin et validation, 2. Rédaction offre d'emploi, 3. Diffusion (sites emploi, réseaux), 4. Réception et tri des candidatures, 5. Tests et évaluations, 6. Entretiens (grille d'évaluation), 7. Référencements, 8. Offre d'emploi, 9. Intégration onboarding.
Inclure : grille d'évaluation entretien, modèle offre d'emploi, checklist onboarding.`,
  },
  {
    id: 'code-conduite',
    categorie: 'rh',
    label: 'Code de Conduite',
    description: "Code d'éthique et de conduite professionnelle",
    icon: '⭐',
    complexity: 'standard',
    inputs: [
      { id: 'valeurs', label: 'Valeurs de l\'entreprise', type: 'text', placeholder: 'Intégrité, Excellence, Respect' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)} | Valeurs : ${ctx.inputs.valeurs || 'Intégrité, Excellence, Respect'}

MISSION : Génère le code de conduite et d'éthique professionnelle de ${ctx.entreprise}.
Sections : 1. Nos valeurs, 2. Conflits d'intérêts, 3. Confidentialité, 4. Respect et inclusion, 5. Anti-corruption et cadeaux, 6. Utilisation des ressources, 7. Réseaux sociaux, 8. Signalement des violations, 9. Sanctions. Ton professionnel et bienveillant.`,
  },
]

// ── Documents Audit ────────────────────────────────────────────────────────────

const AUDIT_DOCS: ExpertiseDoc[] = [
  {
    id: 'plan-audit-annuel',
    categorie: 'audit',
    label: "Plan d'Audit Annuel",
    description: "Plan d'audit interne annuel multi-domaines",
    icon: '🛡️',
    complexity: 'complet',
    inputs: [
      { id: 'exercice', label: 'Exercice', type: 'text', placeholder: '2025' },
      { id: 'domaines', label: 'Domaines à auditer', type: 'text', placeholder: 'Finance, RH, Achats, Stocks, Informatique' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice || '2025'}
Domaines : ${ctx.inputs.domaines || 'Finance, RH, Achats, Stocks'}

MISSION : Génère le plan d'audit annuel complet.
Inclure : cartographie des risques, calendrier des missions (trimestres), ressources allouées, objectifs par domaine, méthodologie (interview, tests, observation), livrables attendus, comité d'audit, budget prévisionnel. Conformité aux normes IIA et OHADA.`,
  },
  {
    id: 'questionnaire-audit-finance',
    categorie: 'audit',
    label: 'Questionnaire Audit Finance',
    description: 'Questionnaire d\'audit du processus financier',
    icon: '❓',
    complexity: 'standard',
    inputs: [
      { id: 'periode', label: 'Période auditée', type: 'text', placeholder: 'S1 2024' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.periode || 'En cours'}

MISSION : Génère le questionnaire d'audit du processus Finance/Comptabilité.
Sections : A. Trésorerie (20 questions), B. Comptabilité générale (15 questions), C. Facturation clients (15 questions), D. Achats fournisseurs (15 questions), E. Fiscalité TVA/IS (10 questions), F. États financiers (10 questions).
Format : N° | Question | Oui/Non/NA | Observation | Référence | Risque associé.`,
  },
  {
    id: 'matrice-risques',
    categorie: 'audit',
    label: 'Matrice des Risques',
    description: 'Matrice de risques avec probabilité × impact',
    icon: '🎯',
    complexity: 'standard',
    inputs: [
      { id: 'domaines', label: 'Domaines de risque', type: 'text', placeholder: 'Financier, Opérationnel, RH, IT, Fiscal' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)} | Domaines : ${ctx.inputs.domaines || 'Financier, Opérationnel, RH, IT, Fiscal'}

MISSION : Génère la matrice des risques de ${ctx.entreprise}.
Pour chaque risque : Description | Domaine | Probabilité (1-5) | Impact (1-5) | Score (P×I) | Niveau (Critique/Élevé/Modéré/Faible) | Responsable | Dispositifs de contrôle existants | Actions recommandées | Échéance.
Minimum 25 risques couvrant les domaines mentionnés. Légende de cotation. Heatmap textuelle.`,
  },
  {
    id: 'rapport-audit',
    categorie: 'audit',
    label: "Rapport d'Audit",
    description: "Rapport d'audit interne professionnel",
    icon: '📋',
    complexity: 'complet',
    inputs: [
      { id: 'domaine', label: 'Domaine audité', type: 'text', placeholder: 'Processus Achats', required: true },
      { id: 'periode', label: 'Période auditée', type: 'text', placeholder: 'Q3 2024' },
      { id: 'auditeur', label: 'Auditeur responsable', type: 'text', placeholder: 'M. DIALLO Audit' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)}

MISSION : Génère un rapport d'audit interne professionnel.
Domaine : ${ctx.inputs.domaine} | Période : ${ctx.inputs.periode || 'N/A'} | Auditeur : ${ctx.inputs.auditeur || 'Équipe Audit'}

Structure : 1. Résumé exécutif (synthèse dirigeants), 2. Contexte et objectifs, 3. Périmètre et méthode, 4. Constats (tableau : réf | constat | risque | criticité | recommandation), 5. Points positifs, 6. Plan d'actions recommandé, 7. Conclusion, 8. Annexes. Notation globale (satisfaisant / à améliorer / insuffisant).`,
  },
  {
    id: 'plan-actions-audit',
    categorie: 'audit',
    label: "Plan d'Actions Audit",
    description: 'Suivi des recommandations et plan de remédiation',
    icon: '✅',
    complexity: 'standard',
    inputs: [
      { id: 'audit_ref', label: 'Audit de référence', type: 'text', placeholder: 'Audit Finance Q3 2024' },
      { id: 'nb_recommandations', label: 'Nombre de recommandations', type: 'number', placeholder: '12' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)}

MISSION : Génère le plan d'actions de suivi des recommandations d'audit.
Audit : ${ctx.inputs.audit_ref || 'Audit interne 2024'} | Recommandations : ${ctx.inputs.nb_recommandations || '10'}

Format tableau : N° | Recommandation | Priorité | Responsable | Action décidée | Ressources | Échéance | Avancement (%) | Statut (En cours/Réalisé/Reporté) | Commentaire.
Inclure : récapitulatif par priorité (critique/haute/moyenne), taux de mise en œuvre, revue par le comité d'audit.`,
  },
]

// ── Documents Fiscalité ────────────────────────────────────────────────────────

const FISCALITE_DOCS: ExpertiseDoc[] = [
  {
    id: 'calendrier-fiscal',
    categorie: 'fiscalite',
    label: 'Calendrier Fiscal',
    description: 'Calendrier des échéances fiscales et sociales',
    icon: '📅',
    complexity: 'standard',
    inputs: [
      { id: 'annee', label: 'Année', type: 'number', placeholder: '2025', required: true },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère le calendrier fiscal complet pour l'année ${ctx.inputs.annee || '2025'} en ${ctx.pays}.
Format mensuel : chaque mois → liste des obligations avec date limite, montant indicatif, pénalités retard.
Couvrir : TVA ${ctx.paysConfig.tva}% mensuelle, IS (acomptes + solde), CNSS ${ctx.paysConfig.cnss_patronal}%, IRPP, Patente, DAS, Taxe apprentissage, autres taxes locales.
Rappels spéciaux pour les mois clés. Format agenda pratique avec ✅ cases à cocher.`,
  },
  {
    id: 'declaration-tva',
    categorie: 'fiscalite',
    label: 'Déclaration TVA',
    description: 'Modèle de déclaration TVA mensuelle / trimestrielle',
    icon: '🏛️',
    complexity: 'standard',
    inputs: [
      { id: 'periode', label: 'Période', type: 'text', placeholder: 'Janvier 2025', required: true },
      { id: 'ca_ht', label: 'CA HT de la période', type: 'number', placeholder: '10000000' },
      { id: 'tva_collectee', label: 'TVA collectée', type: 'number', placeholder: '1800000' },
      { id: 'tva_deductible', label: 'TVA déductible sur achats', type: 'number', placeholder: '500000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.periode}

MISSION : Génère la déclaration TVA pour ${ctx.pays}.
CA HT : ${ctx.inputs.ca_ht || 'N/C'} ${ctx.paysConfig.devise}
TVA collectée (${ctx.paysConfig.tva}%) : ${ctx.inputs.tva_collectee || 'N/C'} ${ctx.paysConfig.devise}${ctx.paysConfig.tva_note ? ' + ' + ctx.paysConfig.tva_note : ''}
TVA déductible : ${ctx.inputs.tva_deductible || 'N/C'} ${ctx.paysConfig.devise}
TVA nette à payer : ${Math.max(0, (Number(ctx.inputs.tva_collectee) || 0) - (Number(ctx.inputs.tva_deductible) || 0))} ${ctx.paysConfig.devise}

Formulaire officiel complet avec toutes les rubriques requises, récapitulatif, base de pénalités si retard, instructions de paiement DGI ${ctx.pays}.`,
  },
  {
    id: 'guide-obligations-fiscales',
    categorie: 'fiscalite',
    label: 'Guide Obligations Fiscales',
    description: "Guide pratique de toutes les obligations fiscales",
    icon: '📖',
    complexity: 'standard',
    inputs: [],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un guide pratique complet des obligations fiscales pour une ${ctx.secteur} en ${ctx.pays}.
Chapitres : 1. TVA — calcul, déclaration, délais, 2. Impôt sur les Sociétés (IS ${ctx.paysConfig.is}%) — acomptes et solde, 3. IRPP et charges sociales, 4. Patente, 5. DAS, 6. Autres taxes, 7. Obligations comptables, 8. Pénalités et sanctions, 9. Contrôle fiscal — droits et obligations, 10. Optimisation légale. Contacts DGI ${ctx.pays}.`,
  },
]

// ── Documents Qualité ──────────────────────────────────────────────────────────

const QUALITE_DOCS: ExpertiseDoc[] = [
  {
    id: 'manuel-qualite',
    categorie: 'qualite',
    label: 'Manuel Qualité',
    description: 'Manuel qualité ISO 9001 adapté',
    icon: '✅',
    complexity: 'complet',
    inputs: [
      { id: 'norme', label: 'Norme cible', type: 'select', options: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'Qualité interne'], defaultValue: 'ISO 9001:2015' },
      { id: 'perimetre', label: 'Périmètre certifié', type: 'text', placeholder: 'Toute l\'entreprise' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)} | Norme : ${ctx.inputs.norme || 'ISO 9001:2015'} | Périmètre : ${ctx.inputs.perimetre || 'Toute l\'entreprise'}

MISSION : Génère le manuel qualité conforme à la norme ${ctx.inputs.norme || 'ISO 9001:2015'}.
Chapitres (selon structure ISO HLS) : 1. Contexte, 2. Leadership, 3. Planification, 4. Support, 5. Réalisation, 6. Évaluation des performances, 7. Amélioration. Inclure : politique qualité signée DG, objectifs qualité mesurables, carte des processus, responsabilités.`,
  },
  {
    id: 'processus-metier',
    categorie: 'qualite',
    label: 'Fiche Processus Métier',
    description: 'Description textuelle d\'un processus métier',
    icon: '🔄',
    complexity: 'rapide',
    inputs: [
      { id: 'processus', label: 'Nom du processus', type: 'text', placeholder: 'Processus Vente & Facturation', required: true },
      { id: 'pilote', label: 'Pilote du processus', type: 'text', placeholder: 'Responsable Commercial' },
    ],
    buildPrompt: ctx => `${BASE}
${entrepriseHeader(ctx)}

MISSION : Génère la fiche de description du processus "${ctx.inputs.processus}".
Pilote : ${ctx.inputs.pilote || 'À définir'}

Structure : Finalité, Données d'entrée, Données de sortie, Acteurs, Ressources, Sous-processus et activités séquencées (10-15 étapes), Indicateurs de performance (KPIs), Documents associés, Risques du processus et contrôles, Critères de performance.`,
  },
]

// ── Documents Business Plan ────────────────────────────────────────────────────

const BUSINESS_DOCS: ExpertiseDoc[] = [
  {
    id: 'business-plan-complet',
    categorie: 'business',
    label: 'Business Plan Complet',
    description: 'Business plan bankable prêt pour investisseurs',
    icon: '💼',
    complexity: 'complet',
    inputs: [
      { id: 'produit', label: 'Produit / Service', type: 'text', placeholder: 'Conseil en gestion PME', required: true },
      { id: 'marche', label: 'Marché cible', type: 'text', placeholder: 'PME Congo-Brazzaville', required: true },
      { id: 'ca_cible', label: 'CA cible an 1 (estimé)', type: 'number', placeholder: '50000000' },
      { id: 'investissement', label: 'Investissement initial', type: 'number', placeholder: '20000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un business plan complet et bankable.
Activité : ${ctx.inputs.produit} | Marché : ${ctx.inputs.marche}
CA cible an 1 : ${ctx.inputs.ca_cible || 'N/C'} ${ctx.paysConfig.devise} | Investissement : ${ctx.inputs.investissement || 'N/C'} ${ctx.paysConfig.devise}

Sections : 1. Executive Summary, 2. Présentation de l'entreprise, 3. Produits/Services, 4. Analyse du marché (taille, concurrence, positionnement), 5. Stratégie commerciale, 6. Organisation et RH, 7. Prévisionnel financier sur 3 ans (CA, charges, résultat, trésorerie), 8. Plan de financement, 9. Analyse des risques. Adapté aux conditions économiques de ${ctx.pays}.`,
  },
  {
    id: 'executive-summary',
    categorie: 'business',
    label: 'Executive Summary',
    description: "Résumé exécutif d'une page pour investisseurs",
    icon: '⚡',
    complexity: 'rapide',
    inputs: [
      { id: 'concept', label: 'Concept en 1 phrase', type: 'text', placeholder: 'Plateforme ERP SaaS pour PME africaines', required: true },
      { id: 'montant', label: 'Financement recherché', type: 'number', placeholder: '100000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère un Executive Summary percutant (1-2 pages) pour lever des fonds.
Concept : ${ctx.inputs.concept} | Financement : ${ctx.inputs.montant || 'N/C'} ${ctx.paysConfig.devise}

Structure : 1. Accroche (problème + solution), 2. Modèle économique, 3. Marché (taille + opportunité), 4. Avantage concurrentiel, 5. Équipe, 6. Traction et résultats, 7. Prévisionnel synthétique, 8. Appel à l'action (montant recherché + utilisation). Ton investisseur.`,
  },
  {
    id: 'previsionnel-financier',
    categorie: 'business',
    label: 'Prévisionnel Financier 3 ans',
    description: 'Tableau prévisionnel de compte de résultat sur 3 ans',
    icon: '📊',
    complexity: 'complet',
    inputs: [
      { id: 'ca_an1', label: 'CA estimé Année 1', type: 'number', placeholder: '30000000', required: true },
      { id: 'croissance', label: 'Taux de croissance (%/an)', type: 'number', placeholder: '30' },
      { id: 'charges_fixes', label: 'Charges fixes mensuelles', type: 'number', placeholder: '2000000' },
    ],
    buildPrompt: ctx => {
      const ca1 = Number(ctx.inputs.ca_an1) || 30_000_000
      const g   = (Number(ctx.inputs.croissance) || 30) / 100
      const ca2 = Math.round(ca1 * (1 + g))
      const ca3 = Math.round(ca2 * (1 + g))
      const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
      return `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)}

MISSION : Génère le prévisionnel financier sur 3 ans.
CA An 1 : ${fmt(ca1)} | An 2 : ${fmt(ca2)} (+${Math.round(g*100)}%) | An 3 : ${fmt(ca3)} ${ctx.paysConfig.devise}
Charges fixes : ${fmt(Number(ctx.inputs.charges_fixes) || 0)} ${ctx.paysConfig.devise}/mois

Tableaux : Compte de résultat prévisionnel (3 années + écarts), Plan de trésorerie mensuel An 1, Bilans prévisionnels N/N+1/N+2, Ratios clés (marge brute, EBE, résultat net, BFR), Seuil de rentabilité (chiffre et date). IS ${ctx.paysConfig.is}%.`
    },
  },
]

// ── Documents Rapports Exécutifs ───────────────────────────────────────────────

const RAPPORTS_DOCS: ExpertiseDoc[] = [
  {
    id: 'rapport-dg',
    categorie: 'rapports',
    label: 'Rapport Direction Générale',
    description: 'Rapport DG mensuel/trimestriel/annuel',
    icon: '📈',
    complexity: 'complet',
    inputs: [
      { id: 'periode', label: 'Période couverte', type: 'text', placeholder: 'Trimestre 1 — 2025', required: true },
      { id: 'destinataire', label: 'Destinataire', type: 'text', placeholder: 'Conseil d\'Administration' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.periode} | Pour : ${ctx.inputs.destinataire || 'Conseil d\'Administration'}

MISSION : Génère le rapport de direction générale professionnel.
Sections : 1. Faits marquants de la période, 2. Performance financière (CA, marges, trésorerie), 3. Performance opérationnelle par service, 4. RH et social (effectifs, formations, absences), 5. Commercial (pipeline, clients gagnés/perdus), 6. Points d'attention et risques, 7. Projets en cours, 8. Objectifs période suivante, 9. Décisions à prendre. Synthèse 1 page en tête de document.`,
  },
  {
    id: 'rapport-financier',
    categorie: 'rapports',
    label: 'Rapport Financier',
    description: 'Rapport financier détaillé avec KPIs',
    icon: '💰',
    complexity: 'complet',
    inputs: [
      { id: 'exercice', label: 'Exercice / Période', type: 'text', placeholder: '2024', required: true },
      { id: 'ca', label: 'CA de la période', type: 'number', placeholder: '100000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Exercice : ${ctx.inputs.exercice} | CA : ${ctx.inputs.ca || 'N/C'} ${ctx.paysConfig.devise}

MISSION : Génère le rapport financier annuel / périodique.
Sections : 1. Synthèse financière (tableau de bord), 2. Analyse du CA (évolution, structure, objectifs), 3. Analyse des charges (fixes vs variables, ratio/CA), 4. Résultat et marges, 5. Position de trésorerie, 6. Bilan synthétique, 7. Ratios de performance (liquidité, solvabilité, rentabilité), 8. Fiscalité et obligations (TVA ${ctx.paysConfig.tva}%, IS ${ctx.paysConfig.is}%), 9. Recommandations.`,
  },
  {
    id: 'rapport-conseil-administration',
    categorie: 'rapports',
    label: 'Rapport Conseil d\'Administration',
    description: 'Rapport présenté en séance du CA',
    icon: '🏛️',
    complexity: 'complet',
    inputs: [
      { id: 'date_seance', label: 'Date de la séance', type: 'text', placeholder: '30/06/2025', required: true },
      { id: 'membres', label: 'Membres présents', type: 'text', placeholder: 'PDG, DG, DAF, 3 administrateurs' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Séance du : ${ctx.inputs.date_seance} | Membres : ${ctx.inputs.membres || 'Voir liste présence'}

MISSION : Génère le rapport du Conseil d'Administration conforme au droit OHADA.
Structure : 1. PV de séance (ouverture, quorum, ordre du jour), 2. Rapport du DG sur la marche des affaires, 3. États financiers présentés, 4. Résolutions soumises au vote, 5. Décisions adoptées avec résultats du vote, 6. Divers, 7. Clôture. Signatures Président + Secrétaire de séance.`,
  },
]

// ── Documents Tableaux de Bord ─────────────────────────────────────────────────

const TABLEAU_DOCS: ExpertiseDoc[] = [
  {
    id: 'tableau-bord-financier',
    categorie: 'tableaux',
    label: 'Tableau de Bord Financier',
    description: 'Dashboard financier avec KPIs et commentaires',
    icon: '📉',
    complexity: 'standard',
    inputs: [
      { id: 'periode', label: 'Période', type: 'text', placeholder: 'Mois de mai 2025', required: true },
      { id: 'ca', label: 'CA de la période', type: 'number', placeholder: '8000000' },
      { id: 'objectif_ca', label: 'Objectif CA', type: 'number', placeholder: '10000000' },
      { id: 'solde_treso', label: 'Solde trésorerie', type: 'number', placeholder: '5000000' },
    ],
    buildPrompt: ctx => {
      const ca  = Number(ctx.inputs.ca) || 0
      const obj = Number(ctx.inputs.objectif_ca) || 1
      const att = obj > 0 ? Math.round((ca / obj) * 100) : 0
      const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
      return `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.periode}

DONNÉES : CA : ${fmt(ca)} ${ctx.paysConfig.devise} | Objectif : ${fmt(obj)} | Atteinte : ${att}% | Trésorerie : ${fmt(Number(ctx.inputs.solde_treso) || 0)} ${ctx.paysConfig.devise}

MISSION : Génère un tableau de bord financier mensuel avec KPIs clés, analyse des écarts vs objectifs, indicateurs de tendance (fléché ▲/▼), alertes automatiques, commentaires d'analyse, recommandations MIAA+ pour la prochaine période.`
    },
  },
  {
    id: 'tableau-bord-rh',
    categorie: 'tableaux',
    label: 'Tableau de Bord RH',
    description: 'Dashboard RH — effectifs, masse salariale, absentéisme',
    icon: '👥',
    complexity: 'standard',
    inputs: [
      { id: 'periode', label: 'Période', type: 'text', placeholder: 'Mois de mai 2025' },
      { id: 'effectif', label: 'Effectif total', type: 'number', placeholder: '45' },
      { id: 'masse_salariale', label: 'Masse salariale brute', type: 'number', placeholder: '18000000' },
    ],
    buildPrompt: ctx => `${BASE}
${paysHeader(ctx)}
${entrepriseHeader(ctx)} | Période : ${ctx.inputs.periode} | Effectif : ${ctx.inputs.effectif || 'N/C'} | Masse salariale : ${ctx.inputs.masse_salariale || 'N/C'} ${ctx.paysConfig.devise}

MISSION : Génère le tableau de bord RH mensuel.
KPIs : effectifs (CDI/CDD/prestataires), recrutements, départs, turn-over, absentéisme, masse salariale (brut/charges/net), coût moyen/employé, heures formation, CNSS (salarial ${ctx.paysConfig.cnss_salarial}% + patronal ${ctx.paysConfig.cnss_patronal}%), indicateurs de bien-être. Alertes, tendances, recommandations.`,
  },
]

// ── Catalogue complet ──────────────────────────────────────────────────────────

export const EXPERTISE_DOCS: ExpertiseDoc[] = [
  ...OHADA_DOCS,
  ...CONTRATS_DOCS,
  ...RH_DOCS,
  ...AUDIT_DOCS,
  ...FISCALITE_DOCS,
  ...QUALITE_DOCS,
  ...BUSINESS_DOCS,
  ...RAPPORTS_DOCS,
  ...TABLEAU_DOCS,
]

export function getDocsByCategorie(cat: string): ExpertiseDoc[] {
  return EXPERTISE_DOCS.filter(d => d.categorie === cat)
}

export function getDocById(id: string): ExpertiseDoc | undefined {
  return EXPERTISE_DOCS.find(d => d.id === id)
}

export const COMPLEXITY_LABEL: Record<string, string> = {
  rapide:   '~30s · Haiku',
  standard: '~1min · Haiku',
  complet:  '~2min · Sonnet',
}
