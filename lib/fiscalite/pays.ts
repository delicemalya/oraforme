// ── Configuration fiscale multi-pays — Sources officielles OHADA/DGI/CNSS ────
// Données à jour 2025-2026
// Congo: DGI, CNSS · RDC: DGRAD, INSS · Cameroun: DGI, CNPS
// Gabon: DGI, CNSS · France: DGFIP, URSSAF · etc.

import type { PaysConfig } from './types'

export const PAYS_CONFIGS: Record<string, PaysConfig> = {

  // ── CONGO-BRAZZAVILLE ─────────────────────────────────────────────────────
  CG: {
    code: 'CG', nom: 'Congo-Brazzaville', drapeau: '🇨🇬',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.18,
      taxes_additionnelles: [
        { code: 'CA', nom: "Centime Additionnel (Contrib. d'Appui)", taux: 0.05, base: 'tva_collectee' },
      ],
      regime: 'mensuel',
      seuil_assujettissement: 90_000_000,  // LF n°42-2025 du 31/12/2025 Art. 234 — relevé de 50M à 90M FCFA
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Sécurité Sociale',
      acronyme: 'CNSS',
      taux_salarie: 0.04,     // VID 4% salarié (plafonné 1 200 000 FCFA/mois)
      taux_patronal: 0.2328,  // VID 8% + AF 10.03% + AT 2.25% + TUS 3% = 23.28%
      plafond_mensuel: 1_200_000,  // plafond vieillesse-décès (VID)
      plafond_annuel: null,
      branches: ['Vieillesse-Décès (VID)', 'Allocations Familiales (AF)', 'Accidents du Travail (AT)', 'Taxe Unique sur les Salaires (TUS)'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IRPP',
      abattement_pct: 0,  // barème mensuel bulletin de paie — pas d'abattement (LF 2026 Art. 76 CGI)
      tranches: [
        { min: 0,          max: 464_000,   taux: 0    },  // exonéré
        { min: 464_001,    max: 1_000_000, taux: 0.01 },  // 1%
        { min: 1_000_001,  max: 3_000_000, taux: 0.10 },  // 10%
        { min: 3_000_001,  max: 8_000_000, taux: 0.25 },  // 25%
        { min: 8_000_001,  max: Infinity,  taux: 0.40 },  // 40%
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [
      { code: 'PATENTE', nom: 'Patente', base: 'CA', echeance_mois: 1, echeance_jour: 31 },
      { code: 'TVTS', nom: 'Taxe sur les Véhicules de Tourisme', base: 'véhicule', montant_fixe: 50_000, echeance_mois: 3, echeance_jour: 31 },
    ],
    notes_importantes: [
      'TVA 18% + Centime Additionnel 5% sur TVA = total 19.8% sur HT',
      'SMIG : 90 000 FCFA/mois (arrêté 2020)',
      'Déclaration TVA obligatoire avant le 20 du mois suivant',
      'CNSS Congo : salarié 4% VID (plaf. 1 200 000) · patronal 8% VID (plaf. 1 200 000) + 10.03% AF + 2.25% AT (plaf. 600 000) + 3% TUS (déplafonné)',
    ],
  },

  // ── RDC ──────────────────────────────────────────────────────────────────
  CD: {
    code: 'CD', nom: 'RD Congo (Kinshasa)', drapeau: '🇨🇩',
    devise: 'CDF', symbole: 'FC',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.16,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 80_000_000,
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Institut National de Sécurité Sociale',
      acronyme: 'INSS',
      taux_salarie: 0.035,    // 3.5%
      taux_patronal: 0.13,    // 13%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Retraite', 'Accident du Travail', 'Invalidité'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IPR (Impôt Professionnel sur les Revenus)',
      abattement_pct: 0,
      tranches: [
        { min: 0,        max: 524_160,  taux: 0 },
        { min: 524_161,  max: 1_680_000, taux: 0.15 },
        { min: 1_680_001, max: 3_360_000, taux: 0.20 },
        { min: 3_360_001, max: 5_040_000, taux: 0.25 },
        { min: 5_040_001, max: Infinity,  taux: 0.30 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 15,
    },
    taxes_annuelles: [
      { code: 'IBP', nom: "Impôt sur les Bénéfices et Profits (30%)", base: 'résultat', taux: 0.30, echeance_mois: 3, echeance_jour: 31 },
    ],
    notes_importantes: [
      'TVA 16% — seuil assujettissement : 80M FC/an',
      'Entreprises : IBP 30% sur bénéfice net',
      'SMIG : 11 246 CDF/jour (révision 2018)',
    ],
  },

  // ── CAMEROUN ─────────────────────────────────────────────────────────────
  CM: {
    code: 'CM', nom: 'Cameroun', drapeau: '🇨🇲',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.1925,   // TVA 19,25% — taux officiel LF Cameroun (17,5% + CAC 10% sur TVA intégré)
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 50_000_000,
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Prévoyance Sociale',
      acronyme: 'CNPS',
      taux_salarie: 0.042,    // 4,2% salarié (Vieillesse + AT + AF — plafonné 750k)
      taux_patronal: 0.137,   // 11,2% CNPS patronal + 1,5% CFC + 1% FNE = 13,7% (source: Central Africa Tax Guide 2023)
      plafond_mensuel: 750_000,
      plafond_annuel: null,
      branches: ['Vieillesse', 'Accident du Travail', 'Allocations Familiales'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IRPP',
      abattement_pct: 0.30,
      // Source: fiscalite-cameroun.ts · Central Africa Tax Guide 2023 · CGI Cameroun Art. 17
      // Tranches annuelles — CAC 10% intégré dans les taux (moteur engine.ts ne gère pas CAC séparément)
      tranches: [
        { min: 0,          max: 2_000_000, taux: 0.11  },  // 10% × 1,10 CAC
        { min: 2_000_001,  max: 3_000_000, taux: 0.165 },  // 15% × 1,10 CAC
        { min: 3_000_001,  max: 5_000_000, taux: 0.275 },  // 25% × 1,10 CAC
        { min: 5_000_001,  max: Infinity,  taux: 0.385 },  // 35% × 1,10 CAC
      ],
      periodicite: 'mensuel',
      echeance_jour: 15,
    },
    taxes_annuelles: [
      { code: 'PATENTE', nom: 'Droit de Patente', base: 'CA', echeance_mois: 1, echeance_jour: 31 },
    ],
    notes_importantes: [
      'TVA 19,25% (taux officiel LF Cameroun = 17,5% base + CAC 10% sur TVA)',
      'CNPS sal 4,2% + pat 11,2% · CFC sal 1% + pat 1,5% · FNE pat 1% · plafond 750 000 FCFA',
      'IS 30% + CAC 10% sur IS = 33% effectif',
      'IRPP 4 tranches annuelles 10→35% + abattement 30% + CAC 10% sur IRPP calculé',
    ],
  },

  // ── GABON ────────────────────────────────────────────────────────────────
  GA: {
    code: 'GA', nom: 'Gabon', drapeau: '🇬🇦',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.18,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 60_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Sécurité Sociale',
      acronyme: 'CNSS',
      taux_salarie: 0.025,    // 2.5%
      taux_patronal: 0.201,   // 20.1% (retraite 5.1% + AT 3% + famille 10% + employeur aut. 2%)
      plafond_mensuel: 1_500_000,
      plafond_annuel: null,
      branches: ['Vieillesse-Retraite', 'Accident du Travail', 'Prestations Familiales'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IRPP',
      abattement_pct: 0.20,
      tranches: [
        { min: 0,          max: 1_500_000, taux: 0 },
        { min: 1_500_001,  max: 1_920_000, taux: 0.05 },
        { min: 1_920_001,  max: 2_700_000, taux: 0.10 },
        { min: 2_700_001,  max: 3_600_000, taux: 0.15 },
        { min: 3_600_001,  max: 5_160_000, taux: 0.20 },
        { min: 5_160_001,  max: 7_500_000, taux: 0.25 },
        { min: 7_500_001,  max: 11_000_000, taux: 0.30 },
        { min: 11_000_001, max: Infinity,   taux: 0.35 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [
      { code: 'IS', nom: 'Impôt sur les Sociétés (35%)', base: 'résultat', taux: 0.35, echeance_mois: 3, echeance_jour: 31 },
    ],
    notes_importantes: [
      'CNSS patronal 20.1% — un des plus élevés de la zone CEMAC',
      'SMIG : 150 000 FCFA/mois',
      'IS 35% minimum max(1,1% CA, 600 000 XAF) — Central Africa Tax Guide 2023',
    ],
  },

  // ── RCA ──────────────────────────────────────────────────────────────────
  CF: {
    code: 'CF', nom: 'République Centrafricaine', drapeau: '🇨🇫',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.19,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 30_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Sécurité Sociale',
      acronyme: 'CNSS',
      taux_salarie: 0.03,
      taux_patronal: 0.14,
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Retraite', 'Accident du Travail', 'Maternité'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'Impôt sur les Traitements et Salaires (ITS)',
      abattement_pct: 0.15,
      tranches: [
        { min: 0,         max: 600_000,  taux: 0 },
        { min: 600_001,   max: 2_000_000, taux: 0.10 },
        { min: 2_000_001, max: 5_000_000, taux: 0.20 },
        { min: 5_000_001, max: Infinity,  taux: 0.30 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [],
    notes_importantes: ['TVA 19% · Pays OHADA · Devise FCFA zone CEMAC'],
  },

  // ── TCHAD ────────────────────────────────────────────────────────────────
  TD: {
    code: 'TD', nom: 'Tchad', drapeau: '🇹🇩',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.18,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 100_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Prévoyance Sociale',
      acronyme: 'CNPS',
      taux_salarie: 0.024,   // 2.4%
      taux_patronal: 0.156,  // 15.6%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Vieillesse', 'Accident du Travail', 'Prestations Familiales'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IS (Impôt sur les Salaires)',
      abattement_pct: 0.10,
      tranches: [
        { min: 0,          max: 800_000,  taux: 0 },
        { min: 800_001,    max: 2_000_000, taux: 0.10 },
        { min: 2_000_001,  max: 6_000_000, taux: 0.20 },
        { min: 6_000_001,  max: Infinity,  taux: 0.30 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [],
    notes_importantes: ['Seuil TVA élevé : 100M FCFA/an', 'Pays enclavé, régime fiscal simplifié pour PME'],
  },

  // ── ANGOLA ───────────────────────────────────────────────────────────────
  AO: {
    code: 'AO', nom: 'Angola', drapeau: '🇦🇴',
    devise: 'AOA', symbole: 'Kz',
    systeme_comptable: 'IFRS', zone: 'autre',
    tva: {
      taux_normal: 0.14,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 10_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Instituto Nacional de Segurança Social',
      acronyme: 'INSS',
      taux_salarie: 0.03,    // 3%
      taux_patronal: 0.08,   // 8%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Retraite', 'Invalidité', 'Décès', 'Maternité'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IRT (Impôt sur les Revenus du Travail)',
      abattement_pct: 0,
      tranches: [
        { min: 0,           max: 100_000,  taux: 0 },
        { min: 100_001,     max: 150_000,  taux: 0.07 },
        { min: 150_001,     max: 200_000,  taux: 0.10 },
        { min: 200_001,     max: 300_000,  taux: 0.13 },
        { min: 300_001,     max: 500_000,  taux: 0.16 },
        { min: 500_001,     max: 1_000_000, taux: 0.185 },
        { min: 1_000_001,   max: 1_500_000, taux: 0.20 },
        { min: 1_500_001,   max: 2_000_000, taux: 0.215 },
        { min: 2_000_001,   max: 2_500_000, taux: 0.225 },
        { min: 2_500_001,   max: Infinity,  taux: 0.25 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [
      { code: 'IRC', nom: "Impôt sur le Revenu des Sociétés (25%)", base: 'résultat', taux: 0.25, echeance_mois: 5, echeance_jour: 31 },
    ],
    notes_importantes: ['IVA (TVA) 14% · INSS global 11% (3%+8%)', 'Loi 26/20 sur IVA en vigueur'],
  },

  // ── GUINÉE ÉQUATORIALE ───────────────────────────────────────────────────
  GQ: {
    code: 'GQ', nom: 'Guinée Équatoriale', drapeau: '🇬🇶',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'CEMAC',
    tva: {
      taux_normal: 0.15,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 30_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Instituto Nacional de Seguridad Social',
      acronyme: 'INSESO',
      taux_salarie: 0.045,   // 4.5%
      taux_patronal: 0.215,  // 21.5%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Retraite', 'Accident du Travail', 'Santé', 'Maternité'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IRPF (Impuesto sobre la Renta Personal)',
      abattement_pct: 0.10,
      tranches: [
        { min: 0,           max: 1_000_000, taux: 0 },
        { min: 1_000_001,   max: 3_000_000, taux: 0.10 },
        { min: 3_000_001,   max: 6_000_000, taux: 0.20 },
        { min: 6_000_001,   max: Infinity,  taux: 0.25 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [],
    notes_importantes: ['Cotisations INSESO patronal très élevées : 21.5%', 'Pays bilingue FR/ES — fiscalité hybride'],
  },

  // ── MALI ─────────────────────────────────────────────────────────────────
  ML: {
    code: 'ML', nom: 'Mali', drapeau: '🇲🇱',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'UEMOA',
    tva: {
      taux_normal: 0.18,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 100_000_000,
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Institut National de Prévoyance Sociale',
      acronyme: 'INPS',
      taux_salarie: 0.036,   // 3.6%
      taux_patronal: 0.174,  // 17.4%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Retraite', 'Accident du Travail', 'Allocations Familiales'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'ITS (Impôt sur les Traitements et Salaires)',
      abattement_pct: 0.30,
      tranches: [
        { min: 0,          max: 600_000,  taux: 0 },
        { min: 600_001,    max: 1_200_000, taux: 0.05 },
        { min: 1_200_001,  max: 1_800_000, taux: 0.10 },
        { min: 1_800_001,  max: 2_400_000, taux: 0.15 },
        { min: 2_400_001,  max: 3_600_000, taux: 0.20 },
        { min: 3_600_001,  max: Infinity,  taux: 0.30 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 15,
    },
    taxes_annuelles: [],
    notes_importantes: ['UEMOA · TVA 18% · INPS patronal 17.4%', 'SMIG : 40 000 FCFA/mois'],
  },

  // ── BURKINA FASO ─────────────────────────────────────────────────────────
  BF: {
    code: 'BF', nom: 'Burkina Faso', drapeau: '🇧🇫',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'UEMOA',
    tva: {
      taux_normal: 0.18,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 50_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Sécurité Sociale',
      acronyme: 'CNSS',
      taux_salarie: 0.055,   // 5.5%
      taux_patronal: 0.16,   // 16%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Vieillesse', 'Accident du Travail', 'Prestations Familiales'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IUTS (Impôt Unique sur les Traitements et Salaires)',
      abattement_pct: 0.20,
      tranches: [
        { min: 0,           max: 600_000,  taux: 0 },
        { min: 600_001,     max: 1_500_000, taux: 0.1275 },
        { min: 1_500_001,   max: 3_000_000, taux: 0.20 },
        { min: 3_000_001,   max: 5_000_000, taux: 0.25 },
        { min: 5_000_001,   max: Infinity,  taux: 0.30 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [],
    notes_importantes: ['IUTS (IRPP) progressif · CNSS salarié 5.5%', 'SMIG : 34 664 FCFA/mois'],
  },

  // ── NIGER ────────────────────────────────────────────────────────────────
  NE: {
    code: 'NE', nom: 'Niger', drapeau: '🇳🇪',
    devise: 'FCFA', symbole: '₣',
    systeme_comptable: 'SYSCOHADA', zone: 'UEMOA',
    tva: {
      taux_normal: 0.19,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 50_000_000,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Caisse Nationale de Sécurité Sociale',
      acronyme: 'CNSS',
      taux_salarie: 0.036,   // 3.6%
      taux_patronal: 0.154,  // 15.4%
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Vieillesse', 'Accident du Travail', 'Maternité'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IUTS',
      abattement_pct: 0.20,
      tranches: [
        { min: 0,           max: 1_000_000, taux: 0 },
        { min: 1_000_001,   max: 3_000_000, taux: 0.10 },
        { min: 3_000_001,   max: 5_000_000, taux: 0.20 },
        { min: 5_000_001,   max: Infinity,  taux: 0.25 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [],
    notes_importantes: ['TVA 19% · Déclaration avant le 20 du mois suivant'],
  },

  // ── NIGERIA ──────────────────────────────────────────────────────────────
  NG: {
    code: 'NG', nom: 'Nigeria', drapeau: '🇳🇬',
    devise: 'NGN', symbole: '₦',
    systeme_comptable: 'IFRS', zone: 'anglophone',
    tva: {
      taux_normal: 0.075,  // VAT 7.5% depuis 2020
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 25_000_000,
      echeance_jour: 21,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Nigeria Social Insurance Trust Fund / Pension',
      acronyme: 'NSITF/PRA',
      taux_salarie: 0.08,    // 8% pension employee
      taux_patronal: 0.11,   // 10% pension employer + 1% NSITF
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Pension', 'NSITF', 'NHF (Housing)'],
      echeance_jour: 7,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'PAYE (Pay As You Earn)',
      abattement_pct: 0.20,
      tranches: [
        { min: 0,              max: 300_000,    taux: 0.07 },
        { min: 300_001,        max: 600_000,    taux: 0.11 },
        { min: 600_001,        max: 1_100_000,  taux: 0.15 },
        { min: 1_100_001,      max: 1_600_000,  taux: 0.19 },
        { min: 1_600_001,      max: 3_200_000,  taux: 0.21 },
        { min: 3_200_001,      max: Infinity,   taux: 0.24 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 10,
    },
    taxes_annuelles: [
      { code: 'CIT', nom: 'Companies Income Tax (30%)', base: 'résultat', taux: 0.30, echeance_mois: 6, echeance_jour: 30 },
    ],
    notes_importantes: [
      'VAT 7.5% (FIRS) · Pension 8% salarié + 10% patronal',
      'WHT (Withholding Tax) applicable sur dividendes/services',
      'CAC registration obligatoire pour toutes entreprises',
    ],
  },

  // ── FRANCE ───────────────────────────────────────────────────────────────
  FR: {
    code: 'FR', nom: 'France', drapeau: '🇫🇷',
    devise: 'EUR', symbole: '€',
    systeme_comptable: 'PCG', zone: 'UE',
    tva: {
      taux_normal: 0.20,
      taux_reduit: 0.10,
      taux_super_reduit: 0.055,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 0,  // Pas de seuil d'assujettissement (franchise en base: 91 900€)
      echeance_jour: 19,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'URSSAF — Sécurité Sociale Française',
      acronyme: 'URSSAF',
      taux_salarie: 0.228,   // ~22.8% (maladie, vieillesse, chômage, retraite complémentaire)
      taux_patronal: 0.45,   // ~45% (cotisations patronales totales — variable par taille)
      plafond_mensuel: 3_666,   // Plafond SS mensuel 2024 (€)
      plafond_annuel: 43_992,
      branches: ['Maladie-Maternité', 'Retraite de base', 'Retraite complémentaire AGIRC-ARRCO', 'Chômage', 'AT/MP', 'Famille', 'CSG/CRDS'],
      echeance_jour: 15,
      echeance_mois_suivant: false, // DSN mensuelle
    },
    irpp: {
      nom: 'IR (Impôt sur le Revenu) — retenue à la source',
      abattement_pct: 0.10,
      tranches: [
        { min: 0,         max: 11_294,   taux: 0 },
        { min: 11_295,    max: 28_797,   taux: 0.11 },
        { min: 28_798,    max: 82_341,   taux: 0.30 },
        { min: 82_342,    max: 177_106,  taux: 0.41 },
        { min: 177_107,   max: Infinity, taux: 0.45 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 19,
    },
    taxes_annuelles: [
      { code: 'IS', nom: 'Impôt sur les Sociétés (25%)', base: 'résultat', taux: 0.25, echeance_mois: 3, echeance_jour: 15 },
      { code: 'CFE', nom: 'Cotisation Foncière des Entreprises', base: 'valeur locative', echeance_mois: 12, echeance_jour: 15 },
      { code: 'CVAE', nom: 'Cotisation sur la Valeur Ajoutée', base: 'VA', taux: 0.005, echeance_mois: 5, echeance_jour: 3 },
    ],
    notes_importantes: [
      'TVA 20% normal · 10% réduit · 5.5% super-réduit · 2.1% médicaments',
      'DSN mensuelle obligatoire · Prélèvement à la source IR',
      'URSSAF : cotisations salariales ~22.8%, patronales ~45%',
      'IS : 25% (15% pour PME jusqu\'à 42 500€ de bénéfice)',
    ],
  },

  // ── BELGIQUE ─────────────────────────────────────────────────────────────
  BE: {
    code: 'BE', nom: 'Belgique', drapeau: '🇧🇪',
    devise: 'EUR', symbole: '€',
    systeme_comptable: 'PCG', zone: 'UE',
    tva: {
      taux_normal: 0.21,
      taux_reduit: 0.12,
      taux_super_reduit: 0.06,
      taxes_additionnelles: [],
      regime: 'mensuel',
      seuil_assujettissement: 0,
      echeance_jour: 20,
      echeance_mois_suivant: true,
    },
    cnss: {
      nom: 'Office National de Sécurité Sociale',
      acronyme: 'ONSS',
      taux_salarie: 0.1307,   // 13.07%
      taux_patronal: 0.27,    // ~27% (variable selon secteur)
      plafond_mensuel: null,
      plafond_annuel: null,
      branches: ['Pension', 'Chômage', 'Maladie-Invalidité', 'Accidents du Travail', 'Allocations Familiales', 'Vacances Annuelles'],
      echeance_jour: 15,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'IPP (Impôt des Personnes Physiques) — précompte professionnel',
      abattement_pct: 0,
      tranches: [
        { min: 0,         max: 15_820,  taux: 0.25 },
        { min: 15_821,    max: 27_920,  taux: 0.40 },
        { min: 27_921,    max: 48_320,  taux: 0.45 },
        { min: 48_321,    max: Infinity, taux: 0.50 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [
      { code: 'ISOC', nom: 'Impôt des Sociétés (25%)', base: 'résultat', taux: 0.25, echeance_mois: 9, echeance_jour: 30 },
    ],
    notes_importantes: [
      'TVA 21% · ONSS salarié 13.07% · ONSS patronal ~27%',
      'Précompte professionnel mensuel sur rémunérations',
      'IS 20% sur 1ères 100 000€ (PME qualifiées)',
    ],
  },

  // ── SUISSE ───────────────────────────────────────────────────────────────
  CH: {
    code: 'CH', nom: 'Suisse', drapeau: '🇨🇭',
    devise: 'CHF', symbole: 'CHF',
    systeme_comptable: 'IFRS', zone: 'autre',
    tva: {
      taux_normal: 0.081,   // 8.1% depuis 2024
      taux_reduit: 0.026,   // 2.6% hébergement
      taux_super_reduit: 0.026,
      taxes_additionnelles: [],
      regime: 'trimestriel',
      seuil_assujettissement: 100_000,   // 100 000 CHF de CA
      echeance_jour: 60,  // 60 jours après fin de période
      echeance_mois_suivant: false,
    },
    cnss: {
      nom: 'Assurances Sociales (AVS/AI/APG/AC/LPP)',
      acronyme: 'AVS/SUVA',
      taux_salarie: 0.065,   // ~6.5% (AVS 5.3% + AI 0.7% + APG 0.25% + AC 1.1%)
      taux_patronal: 0.065,  // Même montant côté patronal
      plafond_mensuel: null,
      plafond_annuel: 148_200,   // Plafond AVS annuel 2024 (CHF)
      branches: ['AVS (Vieillesse et Survivants)', 'AI (Invalidité)', 'APG (Pertes de gain)', 'AC (Chômage)', 'LPP (Prévoyance profess.)'],
      echeance_jour: 10,
      echeance_mois_suivant: true,
    },
    irpp: {
      nom: 'Impôt à la source (canton dépendant)',
      abattement_pct: 0,
      tranches: [
        { min: 0,          max: 17_800,   taux: 0 },
        { min: 17_801,     max: 31_600,   taux: 0.0077 },
        { min: 31_601,     max: 50_200,   taux: 0.0088 },
        { min: 50_201,     max: 78_100,   taux: 0.0222 },
        { min: 78_101,     max: 103_600,  taux: 0.0330 },
        { min: 103_601,    max: 134_600,  taux: 0.0440 },
        { min: 134_601,    max: 176_000,  taux: 0.0549 },
        { min: 176_001,    max: 755_200,  taux: 0.0800 },
        { min: 755_201,    max: Infinity, taux: 0.1160 },
      ],
      periodicite: 'mensuel',
      echeance_jour: 20,
    },
    taxes_annuelles: [
      { code: 'IS', nom: 'Impôt sur le bénéfice des sociétés (~20%)', base: 'résultat', taux: 0.20, echeance_mois: 3, echeance_jour: 31 },
    ],
    notes_importantes: [
      'TVA 8.1% depuis 2024 (anciennement 7.7%)',
      'AVS/AI/APG/AC : parité employeur/employé (~6.5% chacun)',
      'LPP (2e pilier) : cotisation variable par caisse de pension',
      'Impôt sur le bénéfice : fédéral (8.5%) + cantonal (variable)',
    ],
  },
}

export function getPaysConfig(code: string): PaysConfig {
  return PAYS_CONFIGS[code] ?? PAYS_CONFIGS['CG']
}

export const PAYS_LIST = Object.values(PAYS_CONFIGS).map(p => ({
  code: p.code, nom: p.nom, drapeau: p.drapeau, devise: p.devise,
}))
