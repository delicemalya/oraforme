'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageCircle, Bell, FileText, BarChart2, GraduationCap,
  Send, Upload, Download, RefreshCw, Loader2,
  CheckCircle2, ChevronRight, Sparkles, Minimize2, Maximize2,
  FileUp, Trash2, ExternalLink, BookOpen, Award, ChevronLeft,
  Trophy, RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { useLocale } from '@/lib/hooks/useLocale'
import type { MIAANotification } from '@/lib/miaa/notifications'

// ── Palette bleue (professional Academy) ──────────────────────────────────────
const GC  = '#2563EB'   // blue-600
const GD  = '#1D4ED8'   // blue-700
const GL  = '#EFF6FF'   // blue-50
const GGR = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  agent?: string
}
interface TenantData {
  tenant_id?: string
  secteur?: string
  nom?: string
}
interface Props {
  tenantData?: TenantData
  module?: string
  langue?: string
}
type Tab = 'chat' | 'alertes' | 'documents' | 'rapports' | 'formation'
type AcademyScreen = 'home' | 'level' | 'learning' | 'quiz' | 'result'
type Level = 'debutant' | 'intermediaire' | 'avance' | 'expert'

// ── Catégories Academy (22) ────────────────────────────────────────────────────
const ACADEMY_CATS = [
  { id: 'comptabilite-ohada', label: 'Comptabilité OHADA',    icon: '📒', color: '#2563EB' },
  { id: 'fiscalite',          label: 'Fiscalité Congo',        icon: '🏛️', color: '#7C3AED' },
  { id: 'audit',              label: 'Audit & Contrôle',       icon: '🔍', color: '#DC2626' },
  { id: 'rh-paie',            label: 'RH & Paie',              icon: '👥', color: '#16A34A' },
  { id: 'controle-gestion',   label: 'Contrôle de Gestion',   icon: '📊', color: '#F59E0B' },
  { id: 'finance',            label: 'Finance',                icon: '💹', color: '#0891B2' },
  { id: 'tresorerie',         label: 'Trésorerie & BFR',       icon: '💵', color: '#059669' },
  { id: 'entrepreneuriat',    label: 'Entrepreneuriat',        icon: '🚀', color: '#EA580C' },
  { id: 'genie-civil-btp',    label: 'Génie Civil & BTP',     icon: '🏗️', color: '#78716C' },
  { id: 'gestion-hoteliere',  label: 'Gestion Hôtelière',    icon: '🏨', color: '#0369A1' },
  { id: 'gestion-restaurant', label: 'Gestion Restaurant',    icon: '🍽️', color: '#D97706' },
  { id: 'gestion-pharmacie',  label: 'Gestion Pharmacie',     icon: '💊', color: '#9333EA' },
  { id: 'gestion-clinique',   label: 'Gestion Clinique/Hôpital', icon: '🏥', color: '#DC2626' },
  { id: 'gestion-ecole',      label: 'Gestion École',         icon: '🎓', color: '#2563EB' },
  { id: 'cabinet-comptable',  label: 'Cabinet Comptable',     icon: '⚖️', color: '#64748B' },
  { id: 'agriculture-elevage',label: 'Agriculture & Élevage', icon: '🌾', color: '#65A30D' },
  { id: 'gestion-stock',      label: 'Gestion de Stock',      icon: '📦', color: '#16A34A' },
  { id: 'crm-vente',          label: 'CRM & Vente',           icon: '🤝', color: '#F59E0B' },
  { id: 'leadership',         label: 'Leadership',             icon: '⭐', color: '#B45309' },
  { id: 'management',         label: 'Management',             icon: '🎯', color: '#7C3AED' },
  { id: 'banque-microfinance',label: 'Banque & Microfinance', icon: '🏦', color: '#0891B2' },
  { id: 'ong-associations',   label: 'ONG & Associations',    icon: '🤲', color: '#16A34A' },
]

// Module → catégorie recommandée
const MOD_TO_CAT: Record<string, string> = {
  comptabilite: 'comptabilite-ohada', rh: 'rh-paie',
  fiscalite: 'fiscalite', audit: 'audit', tresorerie: 'tresorerie',
  stock: 'gestion-stock', crm: 'crm-vente', ecole: 'gestion-ecole',
  restaurant: 'gestion-restaurant', hotel: 'gestion-hoteliere',
  sante: 'gestion-clinique',
}

// ── Recommandations par secteur d'activité ─────────────────────────────────────
const SECTOR_RECO: Record<string, { cats: string[]; metier: string }> = {
  sante:              { cats: ['gestion-clinique','gestion-pharmacie','rh-paie','fiscalite','comptabilite-ohada'],      metier: 'Clinique / Hôpital' },
  clinique:           { cats: ['gestion-clinique','gestion-pharmacie','rh-paie','comptabilite-ohada'],                  metier: 'Clinique' },
  pharmacie:          { cats: ['gestion-pharmacie','gestion-stock','gestion-clinique','fiscalite','comptabilite-ohada'], metier: 'Pharmacie' },
  hopital:            { cats: ['gestion-clinique','gestion-pharmacie','rh-paie','finance','audit'],                     metier: 'Hôpital' },
  restaurant:         { cats: ['gestion-restaurant','gestion-stock','rh-paie','crm-vente','fiscalite'],                 metier: 'Restauration' },
  hotellerie:         { cats: ['gestion-hoteliere','crm-vente','rh-paie','comptabilite-ohada','fiscalite'],             metier: 'Hôtellerie' },
  btp:                { cats: ['genie-civil-btp','gestion-stock','rh-paie','comptabilite-ohada','fiscalite'],           metier: 'BTP / Construction' },
  'génie-civil':      { cats: ['genie-civil-btp','gestion-stock','rh-paie','comptabilite-ohada'],                      metier: 'Génie Civil' },
  ecole:              { cats: ['gestion-ecole','rh-paie','comptabilite-ohada','fiscalite','management'],                metier: 'École / Formation' },
  cabinet_comptable:  { cats: ['comptabilite-ohada','fiscalite','audit','cabinet-comptable','controle-gestion'],        metier: 'Cabinet Comptable' },
  comptabilite:       { cats: ['comptabilite-ohada','fiscalite','audit','controle-gestion','tresorerie'],               metier: 'Comptabilité' },
  agriculture:        { cats: ['agriculture-elevage','gestion-stock','comptabilite-ohada','rh-paie','entrepreneuriat'], metier: 'Agriculture' },
  elevage:            { cats: ['agriculture-elevage','gestion-stock','comptabilite-ohada','rh-paie'],                   metier: 'Élevage' },
  banque:             { cats: ['banque-microfinance','finance','audit','comptabilite-ohada','fiscalite'],               metier: 'Banque / Finance' },
  microfinance:       { cats: ['banque-microfinance','finance','comptabilite-ohada','tresorerie'],                      metier: 'Microfinance' },
  ong:                { cats: ['ong-associations','comptabilite-ohada','rh-paie','audit','management'],                 metier: 'ONG / Association' },
  commerce:           { cats: ['crm-vente','gestion-stock','comptabilite-ohada','fiscalite','tresorerie'],              metier: 'Commerce / Négoce' },
  industrie:          { cats: ['gestion-stock','rh-paie','comptabilite-ohada','controle-gestion','fiscalite'],         metier: 'Industrie' },
  petrole:            { cats: ['comptabilite-ohada','fiscalite','audit','finance','rh-paie'],                          metier: 'Pétrole / Mines' },
}

// ── Niveaux ────────────────────────────────────────────────────────────────────
const LEVELS: { id: Level; label: string; desc: string; icon: string }[] = [
  { id: 'debutant',      label: 'Débutant',       desc: 'Je découvre le sujet',           icon: '🌱' },
  { id: 'intermediaire', label: 'Intermédiaire',  desc: "J'ai des bases solides",          icon: '📈' },
  { id: 'avance',        label: 'Avancé',          desc: 'Je maîtrise les concepts clés',  icon: '🔥' },
  { id: 'expert',        label: 'Expert',          desc: 'Je veux me perfectionner',       icon: '⚡' },
]

// ── Cours quotidiens (7 thèmes × catégorie, rotation par jour de la semaine) ──
const DAILY_TOPICS: Record<string, string[]> = {
  'comptabilite-ohada': [
    'Écritures de base OHADA — Débit, Crédit, Journal',
    'La balance des comptes et le grand livre',
    'Le bilan SYSCOHADA : actif et passif',
    'Le compte de résultat et les soldes',
    'Amortissements et provisions OHADA',
    'Clôture annuelle et états financiers',
    'TVA 18% + Centime Additionnel 5% Congo',
  ],
  'fiscalite': [
    "IS 30% Congo — Base et calcul",
    "TVA 18% + CA 5% — Déclaration trimestrielle",
    "IRPP progressif — Barème Congo 2024",
    "Patente et taxes locales Brazzaville",
    "Obligations déclaratives DGI Congo",
    "Optimisation fiscale légale OHADA",
    "Contrôles fiscaux : droits et recours",
  ],
  'rh-paie': [
    'Contrat CDI/CDD Congo — Clauses obligatoires',
    'Calcul salaire net — CNSS 5,04% + IRPP',
    'Cotisations patronales CNSS 14,36%',
    'Congés annuels et absences légales',
    'Procédures de licenciement au Congo',
    'Avantages en nature et primes',
    'Stagiaires et apprentis — Cadre légal',
  ],
  'tresorerie': [
    'BFR et FRNG — Formules fondamentales',
    'Prévisions de trésorerie à 30 jours',
    'Ratios de liquidité — Calcul et seuils',
    'Délais de rotation clients/fournisseurs',
    'Mobile Money pro — Airtel, MTN, Orange Congo',
    'Plan de financement court terme',
    'Gestion de crise de liquidité',
  ],
  'audit': [
    'Audit interne OHADA — Périmètre',
    'Scoring risques (grille 100 pts)',
    'Contrôle interne COSO — 5 composantes',
    'Tests de conformité et de substance',
    'Rapport d\'audit — Rédaction et conclusions',
    'Plan d\'action correctif et suivi',
    'Audit fiscal et contrôle DGI',
  ],
  'gestion-clinique': [
    'Organisation cabinet médical — Triage et flux patients',
    'Dossier patient informatisé — CIM-10 et codage',
    'Facturation médicale : actes, consultations, assurances',
    'Protocoles urgences et réanimation de base',
    'Gestion stock pharmacie et médicaments DU',
    'CAMU 80% — Remboursements et tiers-payant Congo',
    'Indicateurs qualité clinique : taux de remplissage, DMS',
  ],
  'gestion-pharmacie': [
    'Réception et contrôle des médicaments — BPD',
    'Gestion FEFO des stocks médicamenteux',
    'Dispensation sur ordonnance — Règles légales',
    'Stupéfiants et psychotropes — Réglementation Congo',
    'Calcul des prix de vente officine',
    'Ruptures de stock — Prévention et substitution',
    'Pharmacovigilance — Déclaration des effets indésirables',
  ],
  'genie-civil-btp': [
    'Lecture de plans et métrés — Bases fondamentales',
    'Devis BTP : matériaux, MO, matériel, frais généraux',
    'Planification PERT/CPM et planning Gantt chantier',
    'Béton armé — Formulation, dosage, coffrage',
    'Gestion de chantier : OPC, sous-traitance, réception',
    'Sécurité chantier — EPI, habilitation, plan PPSPS',
    'Marchés publics BTP au Congo — Procédures ARMP',
  ],
  'agriculture-elevage': [
    'Rotation des cultures — Pratiques et bénéfices',
    'Fertilisation NPK — Dosage et calendrier cultural',
    'Tenue du cahier cultural et des charges',
    'Valorisation des produits agricoles — Filières Congo',
    'Élevage bovin/ovin — Alimentation et prophylaxie',
    'Accès au crédit agricole — CAFI et banques Congo',
    'Certification biologique et normes export',
  ],
  'banque-microfinance': [
    'Analyse crédit PME — Score et garanties',
    'Réglementation COBAC — Ratios prudentiels',
    'Microcrédit solidaire — Méthode et suivi',
    'Gestion du risque de contrepartie',
    'Produits d\'épargne et de placement CEMAC',
    'KYC et lutte anti-blanchiment (LAB/FT)',
    'Reporting BEAC — Déclarations obligatoires',
  ],
  'ong-associations': [
    'Montage de projet — Cadre logique et budget',
    'Comptabilité ONG — Plan comptable spécifique',
    'Reporting bailleur — Indicateurs et justificatifs',
    'Gestion des ressources humaines bénévoles',
    'Passation de marchés ONG — Procédures transparentes',
    'Évaluation d\'impact — Méthodes et outils',
    'Statuts et gouvernance associative au Congo',
  ],
  'gestion-restaurant': [
    'Food cost et prix de revient',
    'Gestion des stocks cuisine FIFO',
    'Ingénierie du menu — Stars & Dogs',
    'Ratios de rentabilité restauration',
    'Hygiène HACCP — Obligations légales',
    'Recrutement personnel salle et cuisine',
    'Caisse journalière et réconciliation',
  ],
  'gestion-hoteliere': [
    "Taux d'occupation et RevPAR",
    'Channel manager et distribution',
    'Gestion housekeeping',
    'Yield management — Tarification',
    'Accueil client 5 étoiles',
    'Revenue Management — KPIs hôtel',
    'Maintenance préventive',
  ],
  'gestion-stock': [
    'Méthode FIFO/FEFO — Valorisation',
    'Formule Wilson — Quantité optimale',
    'Inventaire physique — Procédure',
    'Seuil de réapprovisionnement',
    "Analyse ABC — Classification stock",
    'Rupture de stock — Prévention',
    'Valorisation OHADA des stocks',
  ],
  'crm-vente': [
    'Pipeline commercial — Étapes clés',
    'Scoring leads et qualification',
    'Techniques de closing',
    'Fidélisation client — LTV',
    "Prévisions de vente",
    'KPIs commerciaux essentiels',
    'Relance clients inactifs',
  ],
  'leadership': [
    'Styles de leadership — Situationnel',
    'Délégation efficace',
    'Gestion des conflits en équipe',
    'Communication assertive',
    'Prise de décision sous pression',
    "Développement des talents",
    "Vision stratégique et alignement",
  ],
  'management': [
    'Planification SMART',
    'Organisation et délégation',
    'Contrôle et suivi des performances',
    'Réunions efficaces',
    'Gestion du temps (matrice Eisenhower)',
    'Management par objectifs (MBO)',
    'Culture d\'entreprise et motivation',
  ],
  default: [
    'Les fondamentaux de la gestion',
    'Lire un bilan simplifié',
    'Calculer sa rentabilité',
    'Gérer sa trésorerie',
    'Obligations légales Congo',
    'Développer ses ventes',
    'Manager son équipe',
  ],
}

// ── Quiz (5 questions par catégorie) ──────────────────────────────────────────
interface QuizQ { q: string; opts: string[]; ans: number }

const QUIZ: Record<string, QuizQ[]> = {
  'comptabilite-ohada': [
    { q: 'Le SYSCOHADA révisé comporte combien de classes de comptes ?', opts: ['7','8','9','10'], ans: 2 },
    { q: 'La règle fondamentale : Débit = ?', opts: ['Capital','Actif','Crédit','Résultat'], ans: 2 },
    { q: 'Le compte 411 correspond à :', opts: ['Fournisseurs','Clients','Banque','Caisse'], ans: 1 },
    { q: 'La TVA au Congo est de :', opts: ['15%','18%','20%','25%'], ans: 1 },
    { q: 'Le CA (Centime Additionnel) est de :', opts: ['5% du HT','5% de la TVA','18% du TTC','2% du HT'], ans: 1 },
  ],
  'fiscalite': [
    { q: "Taux IS Congo :", opts: ['25%','28%','30%','33%'], ans: 2 },
    { q: 'Déclaration TVA Congo :', opts: ['Mensuelle','Trimestrielle','Annuelle','Semestrielle'], ans: 1 },
    { q: "1er taux IRPP Congo s'applique à partir de :", opts: ['100 000','250 000','464 001','1 000 000'], ans: 2 },
    { q: 'NIU = ?', opts: ["N° Interne Unique","N° d'Identification Unique","N° Informatique Unifié","N° Indirect Usuel"], ans: 1 },
    { q: 'DGI = ?', opts: ['Direction Générale des Impôts','Déclaration Générale des Investissements','Direction Gestion Interne','Division des Gains Imposables'], ans: 0 },
  ],
  'rh-paie': [
    { q: 'CNSS salarié Congo :', opts: ['4%','4,5%','5,04%','6%'], ans: 2 },
    { q: 'Plafond CNSS Congo :', opts: ['1 000 000','1 500 000','2 000 000','3 000 000'], ans: 1 },
    { q: 'CNSS patronal Congo :', opts: ['10%','12%','14,36%','16%'], ans: 2 },
    { q: 'Médecine du travail (patronal) :', opts: ['0,25%','0,5%','1%','2%'], ans: 1 },
    { q: 'NET = Revenu imposable − ?', opts: ['CNSS','IRPP','IS','CA'], ans: 1 },
  ],
  'tresorerie': [
    { q: 'BFR = ?', opts: ['FRNG − Trésorerie','(Stocks+Créances) − Dettes fourn.','Actif − Passif','Capital − Immobil.'], ans: 1 },
    { q: 'Liquidité générale idéale :', opts: ['> 0,5','> 1','> 1,5','> 2'], ans: 2 },
    { q: 'FRNG = ?', opts: ['Capitaux permanents − Actif immo.','Actif CT − Passif CT','BFR + Trésorerie','CA − Charges'], ans: 0 },
    { q: 'Délai clients idéal :', opts: ['< 30 j','< 60 j','< 90 j','< 120 j'], ans: 0 },
    { q: 'Trésorerie nette = ?', opts: ['FRNG − BFR','BFR − FRNG','Actif − Passif','CA − Charges'], ans: 0 },
  ],
  'gestion-clinique': [
    { q: "Le dossier médical doit être conservé pendant :", opts: ['5 ans','10 ans','20 ans','Toute la vie du patient'], ans: 2 },
    { q: "CAMU couvre quelle proportion des soins au Congo ?", opts: ['50%','70%','80%','100%'], ans: 2 },
    { q: "CIM-10 est :", opts: ["Classification Internationale des Maladies","Contrôle Interne Médical","Code International des Médicaments","Certificat Infirmier Médical"], ans: 0 },
    { q: "Le triage aux urgences classe les patients selon :", opts: ["L'ordre d'arrivée","La priorité médicale","L'assurance","L'âge"], ans: 1 },
    { q: "La facturation des soins médicaux au Congo est :", opts: ["Exonérée de TVA","Soumise à TVA 18%","Soumise à IS","Soumise à patente"], ans: 0 },
  ],
  'gestion-pharmacie': [
    { q: "FEFO signifie :", opts: ["First Expired First Out","First Entry First Out","Fast Exit Fast Open","Final Entry Final Out"], ans: 0 },
    { q: "Une ordonnance est valable :", opts: ["7 jours","30 jours","3 mois","1 an"], ans: 1 },
    { q: "Les stupéfiants sont enregistrés dans :", opts: ["Le stock général","Un registre spécial sécurisé","La caisse","Le bilan"], ans: 1 },
    { q: "Le stock de sécurité couvre :", opts: ["1 semaine","2-4 semaines","6 mois","1 an"], ans: 1 },
    { q: "BPD signifie :", opts: ["Bonnes Pratiques de Distribution","Base de Prix Directeurs","Bilan de Production et Distribution","Bon Produit Disponible"], ans: 0 },
  ],
  'genie-civil-btp': [
    { q: "PERT/CPM est utilisé pour :", opts: ["Évaluer les coûts","Planifier les délais et chemins critiques","Calculer la TVA","Gérer le personnel"], ans: 1 },
    { q: "Le béton C25/30 signifie :", opts: ["25 cm de hauteur","Résistance 25 MPa cylindrique / 30 MPa cubique","Dosage 25 kg/m³","Durée 30 jours"], ans: 1 },
    { q: "TVA sur travaux de construction au Congo :", opts: ["Exonérée","5%","18% + CA","30%"], ans: 2 },
    { q: "Un plan de masse montre :", opts: ["Les coupes transversales","L'implantation du bâtiment sur le terrain","Les détails de fondation","Les réseaux électriques"], ans: 1 },
    { q: "ARMP au Congo gère :", opts: ["Les marchés privés","Les marchés publics","Les concessions minières","Les permis de construire"], ans: 1 },
  ],
  'gestion-restaurant': [
    { q: "Le food cost idéal en restauration est :", opts: ["< 10%","28-35%","50-60%","70-80%"], ans: 1 },
    { q: "Un plat vendu 8 000 FCFA avec food cost 30% a un coût matière de :", opts: ["2 400 FCFA","800 FCFA","4 000 FCFA","1 600 FCFA"], ans: 0 },
    { q: "HACCP est :", opts: ["Un label de qualité","Une méthode d'analyse des risques alimentaires","Un logiciel de caisse","Un ratio de rentabilité"], ans: 1 },
    { q: "Le ticket moyen s'obtient par :", opts: ["CA / Nombre de couverts","CA / Nombre de plats","Charges / CA","CA − Charges"], ans: 0 },
    { q: "La DLC signifie :", opts: ["Date Limite de Commercialisation","Date Limite de Consommation","Délai Legal de Conservation","Date de Livraison Confirmée"], ans: 1 },
  ],
  'gestion-hoteliere': [
    { q: "RevPAR se calcule par :", opts: ["CA / Chambres disponibles","CA / Chambres occupées","Tarif moyen × Taux occupation","A et C sont identiques"], ans: 2 },
    { q: "Le taux d'occupation cible en hôtellerie est :", opts: ["30-40%","50-60%","65-80%","95-100%"], ans: 2 },
    { q: "Le check-in standard est généralement à :", opts: ["10h","12h","14h","18h"], ans: 2 },
    { q: "OTA signifie :", opts: ["Online Travel Agency","Official Tourism Authority","Open Travel Account","Outbound Tourism Association"], ans: 0 },
    { q: "Un client no-show engendre :", opts: ["Un remboursement automatique","Des pénalités selon la politique","Rien","Un upgrade automatique"], ans: 1 },
  ],
  'agriculture-elevage': [
    { q: "La rotation des cultures permet :", opts: ["D'épuiser le sol","D'enrichir et préserver le sol","De réduire les rendements","D'augmenter les coûts"], ans: 1 },
    { q: "NPK signifie :", opts: ["Norme Phytosanitaire du Congo","Azote, Phosphore, Potassium","Nitrate-Potasse-Karite","Normal Plant Kit"], ans: 1 },
    { q: "HACCP en agro-alimentaire signifie :", opts: ["Hazard Analysis Critical Control Points","High Agricultural Crop Control Plan","Harmonized African Crop Certificate","High Accuracy Crop Control"], ans: 0 },
    { q: "La valeur agricole tient compte de :", opts: ["Seulement des ventes","Des cycles culturaux et saisonnalité","Des prix mondiaux uniquement","Des subventions uniquement"], ans: 1 },
    { q: "Le taux de mortalité acceptable en élevage avicole :", opts: ["< 1%","< 5%","< 15%","< 25%"], ans: 1 },
  ],
  'banque-microfinance': [
    { q: "COBAC est :", opts: ["Commission Bancaire d'Afrique Centrale","Banque des États d'Afrique Centrale","Fonds Monétaire Africain","Marché Financier Central"], ans: 0 },
    { q: "KYC signifie :", opts: ["Keep Your Capital","Know Your Customer","Keep Your Contract","Key Yield Control"], ans: 1 },
    { q: "Le ratio de solvabilité minimum COBAC est :", opts: ["4%","6%","8%","12%"], ans: 2 },
    { q: "LAB/FT signifie :", opts: ["Lutte Anti-Blanchiment et Financement du Terrorisme","Loi sur les Actifs Bancaires","Liquidité et Actifs Bancaires Fiduciaires","Livret d'Actifs Bancaires"], ans: 0 },
    { q: "Le microcrédit solidaire fonctionne par :", opts: ["Garantie individuelle","Caution solidaire du groupe","Hypothèque immobilière","Dépôt de garantie en espèces"], ans: 1 },
  ],
  'ong-associations': [
    { q: "Le cadre logique d'un projet contient :", opts: ["Seulement le budget","Objectifs, activités, indicateurs, hypothèses","Seulement les activités","Le plan comptable"], ans: 1 },
    { q: "Un rapport bailleur doit inclure :", opts: ["Seulement les dépenses","Activités, résultats, dépenses et justificatifs","Seulement les activités","Le bilan annuel"], ans: 1 },
    { q: "La transparence financière d'une ONG implique :", opts: ["Garder les comptes secrets","Publier ses états financiers","Payer des dividendes","Réduire les charges"], ans: 1 },
    { q: "Un AGO (Assemblée Générale Ordinaire) se tient :", opts: ["Chaque semaine","Chaque trimestre","Au moins une fois par an","Tous les 5 ans"], ans: 2 },
    { q: "La comptabilité d'une ONG suit :", opts: ["Le plan OHADA adapté","Le plan des sociétés commerciales","Le plan fiscal","Aucun plan standard"], ans: 0 },
  ],
  default: [
    { q: 'OHADA signifie :', opts: ["Organisation pour l'Harmonisation en Afrique du Droit des Affaires","Office des Affaires Dominicales en Afrique","Organisation des Hommes d'Affaires","Ordre des Hommes d'Affaires d'Afrique"], ans: 0 },
    { q: "Combien de pays membres l'OHADA compte-t-elle ?", opts: ['12','14','17','20'], ans: 2 },
    { q: 'SYSCOHADA est :', opts: ['Un logiciel','Le Système Comptable OHADA','Un règlement bancaire','Une directive fiscale'], ans: 1 },
    { q: "Durée d'un exercice comptable OHADA :", opts: ['6 mois','9 mois','12 mois','18 mois'], ans: 2 },
    { q: "Capital minimum d'une SARL au Congo :", opts: ['100 000','500 000','1 000 000','5 000 000'], ans: 0 },
  ],
}

// ── Suggestions par module ─────────────────────────────────────────────────────
const MOD_SUGG: Record<string, string[]> = {
  comptabilite: ['Passer une écriture OHADA', 'Vérifier ma balance comptable', 'Calculer la TVA sur 500 000 FCFA'],
  rh:           ['Calculer le salaire net de 450 000 FCFA', 'Obligations CNSS employeur', 'Rédiger un contrat CDI'],
  tresorerie:   ['Quel est mon solde de trésorerie ?', 'Analyser mes flux du mois', 'Prévision à 30 jours'],
  facturation:  ['Créer une facture OHADA conforme', 'Relancer un client impayé', 'Calculer les pénalités de retard'],
  stock:        ['Articles en rupture de stock', 'Valoriser mon inventaire OHADA', 'Optimiser mes commandes'],
  crm:          ['Analyser mes clients actifs', 'Pipeline commercial du mois', 'Stratégie de fidélisation'],
  fiscalite:    ['Calculer la TVA trimestrielle', 'Déclaration DGI Congo', 'Optimiser mon IS 30%'],
  audit:        ['Lancer un audit OHADA complet', 'Analyser les risques détectés', "Plan d'action correctif"],
  ecole:        ['Calculer les moyennes des élèves', 'Gestion des frais de scolarité', 'Rapport de résultats'],
  restaurant:   ['Analyser le food cost', "Calculer la marge d'un plat", 'Rapport de vente du jour'],
  hotel:        ["Taux d'occupation du mois", 'Revenu par chambre (RevPAR)', 'Rapport housekeeping'],
  sante:        ['Patients du jour', 'Relance consultations impayées', 'Rapport médecin mensuel'],
  depenses:     ['Mes dépenses du mois', 'Quelles charges déduire ?', 'Budget prévisionnel'],
  auto:         ['Calculer la TVA sur 500 000 FCFA', 'Quel est mon solde de trésorerie ?', 'Comment calculer le salaire net ?'],
}

const MOD_EXPERT: Record<string, string> = {
  comptabilite: 'Expert Comptabilité · OHADA',
  rh:           'Expert RH · Droit social',
  tresorerie:   'Expert Trésorerie',
  facturation:  'Expert Facturation',
  stock:        'Expert Inventaire',
  crm:          'Expert Commercial',
  fiscalite:    'Expert Fiscalité',
  audit:        'Expert Audit · OHADA',
  ecole:        'Expert Éducation',
  restaurant:   'Expert Restauration',
  hotel:        'Expert Hôtellerie',
  sante:        'Expert Clinique',
  depenses:     'Expert Dépenses',
  auto:         'Expert IA · Oraforme ERP',
}

const DOC_TYPES = [
  { id: 'rapport_mensuel',    label: 'Rapport mensuel',    icon: '📊', desc: 'Analyse complète du mois' },
  { id: 'rapport_tresorerie', label: 'Analyse trésorerie', icon: '💵', desc: 'Flux et prévisions' },
  { id: 'rapport_stock',      label: 'Rapport stock',      icon: '📦', desc: 'Rotations et ruptures' },
  { id: 'relance_facture',    label: 'Lettre de relance',  icon: '📨', desc: 'Recouvrement client' },
  { id: 'contrat_travail',    label: 'Contrat de travail', icon: '📋', desc: 'CDI/CDD conforme' },
  { id: 'bulletin_paie',      label: 'Résumé paie',        icon: '💰', desc: 'Synthèse masse salariale' },
  { id: 'bilan_simplifie',    label: 'Bilan simplifié',    icon: '📒', desc: 'Actif/Passif OHADA' },
]

const PRIORITY_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626', label: 'Urgent' },
  high:     { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', label: 'Important' },
  medium:   { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', label: 'Info' },
  low:      { bg: 'var(--surface)', border: 'var(--border)', dot: '#94A3B8', label: '' },
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function MIAAAssistant({ tenantData, module = 'auto', langue }: Props) {
  const { t, locale } = useLocale()
  const currentLang = langue || locale || 'fr'

  // Panel
  const [open,      setOpen]      = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  // Chat principal
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)

  // Alertes
  const [notifs,       setNotifs]       = useState<MIAANotification[]>([])
  const [loadNotifs,   setLoadNotifs]   = useState(false)
  const [unreadCount,  setUnreadCount]  = useState(0)

  // Documents
  const [docType,   setDocType]   = useState('')
  const [docCtx,    setDocCtx]    = useState('')
  const [docResult, setDocResult] = useState('')
  const [genDoc,    setGenDoc]    = useState(false)

  // Upload
  const [uploadFile,    setUploadFile]    = useState<File | null>(null)
  const [uploadQ,       setUploadQ]       = useState('Analyse ce fichier et donne-moi les points clés.')
  const [uploadResult,  setUploadResult]  = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)

  // Rapports
  const [rapports,   setRapports]   = useState<{ type: string; contenu: string; created_at: string }[]>([])
  const [selRapport, setSelRapport] = useState<number | null>(null)

  // ── Academy ────────────────────────────────────────────────────────────────
  const [acScreen,   setAcScreen]   = useState<AcademyScreen>('home')
  const [acCat,      setAcCat]      = useState<string>('')
  const [acLevel,    setAcLevel]    = useState<Level>('debutant')
  const [acMessages, setAcMessages] = useState<ChatMessage[]>([])
  const [acInput,    setAcInput]    = useState('')
  const [acSending,  setAcSending]  = useState(false)
  // Quiz
  const [quizIdx,    setQuizIdx]    = useState(0)
  const [quizScore,  setQuizScore]  = useState(0)
  const [quizSel,    setQuizSel]    = useState<number | null>(null)
  const [quizDone,   setQuizDone]   = useState(false)

  const chatBottom = useRef<HTMLDivElement>(null)
  const acBottom   = useRef<HTMLDivElement>(null)
  const fileInput  = useRef<HTMLInputElement>(null)

  // Scroll auto
  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { acBottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [acMessages])

  // Notifs
  useEffect(() => { if (activeTab === 'alertes' && open) loadNotifications() }, [activeTab, open])
  useEffect(() => {
    if (open && tenantData?.tenant_id)
      fetch(`/api/miaa/notifications?tenant_id=${tenantData.tenant_id}`)
        .then(r => r.json()).then(d => setUnreadCount(d.count ?? 0)).catch(() => {})
  }, [open, tenantData?.tenant_id])

  const loadNotifications = useCallback(async () => {
    if (!tenantData?.tenant_id) return
    setLoadNotifs(true)
    try {
      const r = await fetch(`/api/miaa/notifications?tenant_id=${tenantData.tenant_id}`)
      const d = await r.json()
      setNotifs(d.notifications ?? [])
      setUnreadCount(d.count ?? 0)
    } finally { setLoadNotifs(false) }
  }, [tenantData?.tenant_id])

  // ── Chat principal ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)
    const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: now() }])
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res  = await fetch('/api/miaa/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, message: userMsg, history, tenantData, langue: currentLang }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: (data.response as string) ?? 'Erreur de réponse.',
        timestamp: now(), model: data.model_used as string, agent: data.agent_nom as string,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connexion impossible.', timestamp: now() }])
    } finally { setSending(false) }
  }

  // ── Chat formateur (Academy) ───────────────────────────────────────────────
  const sendAcMessage = async () => {
    if (!acInput.trim() || acSending) return
    const userMsg = acInput.trim()
    setAcInput('')
    setAcSending(true)
    const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setAcMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: now() }])
    const cat = ACADEMY_CATS.find(c => c.id === acCat)
    const lvl = LEVELS.find(l => l.id === acLevel)
    const secteurCtx = sectorInfo ? ` L'apprenant travaille dans le secteur : ${sectorInfo.metier}.` : ''
    const teacherCtx = `MODE FORMATEUR ACADEMY MIAA+. Catégorie : ${cat?.label ?? acCat}. Niveau apprenant : ${lvl?.label ?? acLevel}.${secteurCtx} Enseigne comme un professeur expert certifié, avec des exemples concrets adaptés au contexte Congo/OHADA/CEMAC. Utilise des cas réels du secteur. Sois pédagogue, structuré, encourage l'apprenant et valide sa progression. Question de l'apprenant : ${userMsg}`
    try {
      const res  = await fetch('/api/miaa/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'formation', message: teacherCtx, history: [], tenantData, langue: currentLang }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      setAcMessages(prev => [...prev, {
        role: 'assistant',
        content: (data.response as string) ?? 'Erreur de réponse.',
        timestamp: now(), model: data.model_used as string,
      }])
    } catch {
      setAcMessages(prev => [...prev, { role: 'assistant', content: 'Connexion impossible.', timestamp: now() }])
    } finally { setAcSending(false) }
  }

  // ── Document ───────────────────────────────────────────────────────────────
  const generateDocument = async () => {
    if (!docType || genDoc) return
    setGenDoc(true); setDocResult('')
    try {
      const res  = await fetch('/api/miaa/generer-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, context: docCtx, tenant_id: tenantData?.tenant_id }),
      })
      const data = await res.json()
      setDocResult((data.content ?? data.error ?? 'Erreur génération.') as string)
    } finally { setGenDoc(false) }
  }
  const downloadDocument = () => {
    if (!docResult) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([docResult], { type: 'text/plain;charset=utf-8' }))
    a.download = `${docType}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  const analyzeFile = async () => {
    if (!uploadFile || uploadLoading) return
    setUploadLoading(true); setUploadResult('')
    try {
      const fd = new FormData()
      fd.append('file', uploadFile); fd.append('question', uploadQ); fd.append('module', module)
      const res  = await fetch('/api/miaa/upload-analyze', { method: 'POST', body: fd })
      const data = await res.json()
      setUploadResult((data.analysis ?? data.error ?? 'Erreur analyse.') as string)
    } finally { setUploadLoading(false) }
  }

  const markRead = async (id: string) => {
    if (!tenantData?.tenant_id) return
    await fetch('/api/miaa/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantData.tenant_id, notification_id: id, action: 'marquer_lu' }),
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // ── Academy helpers ────────────────────────────────────────────────────────
  const dayOfWeek = new Date().getDay()
  const todayTopic = (catId: string) => {
    const topics = DAILY_TOPICS[catId] ?? DAILY_TOPICS.default
    return topics[dayOfWeek % topics.length]
  }
  const catColor = (catId: string) => ACADEMY_CATS.find(c => c.id === catId)?.color ?? GC
  const catIcon  = (catId: string) => ACADEMY_CATS.find(c => c.id === catId)?.icon ?? '📚'
  const catLabel = (catId: string) => ACADEMY_CATS.find(c => c.id === catId)?.label ?? catId
  const quizQuestions = QUIZ[acCat] ?? QUIZ.default

  // Détection secteur : tenantData.secteur > module > fallback
  const rawSector = (tenantData?.secteur ?? module ?? 'auto').toLowerCase().replace(/[^a-z_-]/g, '')
  const sectorInfo = SECTOR_RECO[rawSector] ?? SECTOR_RECO[MOD_TO_CAT[module] ? module : 'auto'] ?? null
  const sectorCats = sectorInfo?.cats ?? []
  const recommendedCat = sectorCats[0] ?? MOD_TO_CAT[module] ?? null

  // Démarrer la formation : initialise le chat formateur avec le cours du jour
  const startLearning = () => {
    const cat = ACADEMY_CATS.find(c => c.id === acCat)
    const lvl = LEVELS.find(l => l.id === acLevel)
    const topic = todayTopic(acCat)
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const secteurLine = sectorInfo ? `\n🏢 Secteur : ${sectorInfo.metier}` : ''
    setAcMessages([{
      role: 'assistant',
      content: `Bienvenue dans le cours du ${date} !\n\n📚 Sujet du jour : ${topic}\n🎯 Domaine : ${cat?.label}${secteurLine}\n📊 Votre niveau : ${lvl?.label}\n\nJe suis votre formateur MIAA+. Je vais vous enseigner ce sujet étape par étape avec des exemples concrets adaptés à votre activité et au contexte Congo/OHADA.\n\n💡 Tapez "Commence la leçon" pour démarrer, ou posez directement une question sur ce sujet !`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }])
    setAcScreen('learning')
  }

  // Reset quiz
  const startQuiz = () => {
    setQuizIdx(0); setQuizScore(0); setQuizSel(null); setQuizDone(false)
    setAcScreen('quiz')
  }

  const answerQuiz = (idx: number) => {
    if (quizSel !== null) return
    setQuizSel(idx)
    const correct = quizQuestions[quizIdx].ans === idx
    setTimeout(() => {
      if (correct) setQuizScore(s => s + 1)
      if (quizIdx + 1 >= quizQuestions.length) {
        setQuizDone(true); setAcScreen('result')
      } else {
        setQuizIdx(q => q + 1); setQuizSel(null)
      }
    }, 900)
  }

  // ── Dimensions panel ───────────────────────────────────────────────────────
  const panelW = maximized ? 'w-[calc(100vw-16px)] max-w-[700px]' : 'w-[calc(100vw-16px)] max-w-[400px]'
  const panelH = maximized ? 'h-[90dvh] sm:h-[85vh]' : 'h-[90dvh] sm:h-[600px]'

  const TABS = [
    { id: 'chat'      as Tab, label: 'Chat',      Icon: MessageCircle },
    { id: 'alertes'   as Tab, label: 'Alertes',   Icon: Bell,         badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'documents' as Tab, label: 'Documents', Icon: FileText },
    { id: 'rapports'  as Tab, label: 'Rapports',  Icon: BarChart2 },
    { id: 'formation' as Tab, label: 'Academy',   Icon: GraduationCap },
  ]

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Bouton flottant ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed bottom-4 right-2 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-center gap-1"
          >
            <motion.button whileHover={{ scale: 1.10 }} whileTap={{ scale: 0.88 }}
              onClick={() => setOpen(true)}
              className="relative w-[64px] h-[64px] flex items-center justify-center"
              title="MIAA+ — Expert IA Oraforme"
            >
              <motion.div className="absolute inset-[-6px] rounded-full"
                animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                style={{ background: 'conic-gradient(from 0deg, transparent 55%, #DC2626 75%, #FF4444 88%, transparent 100%)', borderRadius: '50%' }}
              />
              <motion.div className="absolute inset-[-2px] rounded-full"
                animate={{ scale: [1, 1.30, 1], opacity: [0.45, 0, 0.45] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: 'radial-gradient(circle, #DC262660 0%, transparent 70%)' }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/miaa-logo.png" alt="MIAA+"
                className="relative z-10 rounded-full object-cover shadow-xl"
                style={{ width: 64, height: 64, filter: 'drop-shadow(0 4px 14px rgba(220,38,38,0.65))' }}
              />
              {unreadCount > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </motion.button>
            <motion.span animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity }}
              className="text-[10px] font-bold tracking-wide select-none"
              style={{ color: '#DC2626', textShadow: '0 1px 4px rgba(220,38,38,0.4)' }}>
              MIAA+
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panel principal ──────────────────────────────────────────────── */}
      {open && (
        <div className={`fixed bottom-4 right-2 sm:bottom-6 sm:right-6 z-[9999] flex flex-col rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden transition-all duration-200 ${panelW} ${panelH}`}
          style={{ background: '#FFFFFF', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>

          {/* Header — vert dégradé */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: GGR }}>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/miaa-logo.png" alt="MIAA+" className="w-9 h-9 rounded-full object-cover shadow-md ring-2 ring-white/30" />
              <div>
                <p className="text-white font-bold text-sm leading-none">MIAA+</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-200 animate-pulse" />
                  <p className="text-white/80 text-[10px]">
                    {activeTab === 'formation'
                      ? (acScreen === 'home' ? 'Academy · Formateur Expert' : `Formateur ${catLabel(acCat)}`)
                      : (MOD_EXPERT[module ?? 'auto'] ?? MOD_EXPERT.auto)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMaximized(v => !v)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                {maximized ? <Minimize2 size={14} className="text-white" /> : <Maximize2 size={14} className="text-white" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
            {TABS.map(({ id, label, Icon, badge }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${
                  activeTab === id ? 'border-b-2' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
                style={activeTab === id ? { color: GC, borderBottomColor: GC } : {}}>
                <div className="relative">
                  <Icon size={14} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[8px] font-bold">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div className="flex-1 min-h-0 overflow-hidden">

            {/* ── CHAT ──────────────────────────────────────────────────── */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-6">
                      <div className="mx-auto mb-3 w-14 h-14 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/miaa-logo.png" alt="MIAA+" className="w-14 h-14 rounded-full object-cover shadow-lg" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white" style={{ background: GC }} />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text)]">{t('miaa.widget.greeting')}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[260px] mx-auto">{t('miaa.widget.desc')}</p>
                      <div className="mt-4 space-y-1.5">
                        {(MOD_SUGG[module ?? 'auto'] ?? MOD_SUGG.auto).map(q => (
                          <button key={q} onClick={() => setInput(q)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[var(--border)] transition-all text-[var(--text-secondary)] hover:text-[var(--text)]"
                            style={{ '--tw-border-opacity': '1' } as React.CSSProperties}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GC; (e.currentTarget as HTMLElement).style.background = GL }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = '' }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user' ? 'text-white rounded-br-sm' : 'text-[var(--text)] border border-[var(--border)] rounded-bl-sm bg-[var(--surface)]'
                      }`} style={m.role === 'user' ? { background: GC } : {}}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] opacity-60">{m.timestamp}</span>
                          {m.agent && <span className="text-[9px] opacity-60">· {m.agent}</span>}
                          {m.model && <span className="text-[9px] opacity-50">· {m.model.includes('haiku') ? 'Haiku' : m.model.includes('opus') ? 'Opus' : 'Sonnet'}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start items-end gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/miaa-logo.png" alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--surface)]">
                        {[0,1,2].map(i => (
                          <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: GC }}
                            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatBottom} />
                </div>
                <div className="shrink-0 border-t border-[var(--border)] px-3 py-2">
                  <div className="flex items-end gap-2">
                    <button onClick={() => fileInput.current?.click()}
                      className="p-2 rounded-xl border border-[var(--border)] hover:border-[#16A34A] transition-colors shrink-0">
                      <FileUp size={14} style={{ color: GC }} />
                    </button>
                    <input ref={fileInput} type="file" className="hidden"
                      accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setActiveTab('documents') } }} />
                    <textarea value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Posez votre question…" rows={1}
                      className="flex-1 resize-none rounded-xl border border-[var(--border)] px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none transition-colors"
                      style={{ maxHeight: '80px' }}
                      onFocus={e => (e.currentTarget.style.borderColor = GC)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending}
                      className="p-2 rounded-xl text-white shrink-0 transition-all disabled:opacity-40"
                      style={{ background: GC }}>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ALERTES ───────────────────────────────────────────────── */}
            {activeTab === 'alertes' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0">
                  <p className="text-xs font-bold text-[var(--text)]">{notifs.length} alerte{notifs.length !== 1 ? 's' : ''}</p>
                  <button onClick={loadNotifications} disabled={loadNotifs}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors">
                    <RefreshCw size={12} className={loadNotifs ? 'animate-spin' : 'text-[var(--text-secondary)]'} style={loadNotifs ? { color: GC } : {}} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {notifs.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: GC }} />
                      <p className="text-xs text-[var(--text-secondary)]">Aucune alerte active.</p>
                    </div>
                  )}
                  {notifs.map(n => {
                    const s = PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.low
                    return (
                      <div key={n.id} className={`p-3 rounded-xl border ${n.lu ? 'opacity-60' : ''}`}
                        style={{ background: s.bg, borderColor: s.border }}>
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: s.dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[var(--text)] leading-tight">{n.titre}</p>
                              {s.label && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: s.dot }}>{s.label}</span>}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {n.action_url && (
                                <Link href={n.action_url} className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: GC }}>
                                  {n.action_label ?? 'Voir'} <ChevronRight size={10} />
                                </Link>
                              )}
                              {!n.lu && (
                                <button onClick={() => markRead(n.id)} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)] ml-auto">
                                  Marquer lu
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── DOCUMENTS ─────────────────────────────────────────────── */}
            {activeTab === 'documents' && (
              <div className="flex flex-col h-full overflow-y-auto">
                <div className="p-3 border-b border-[var(--border)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Générer un document</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {DOC_TYPES.map(dt => (
                      <button key={dt.id} onClick={() => setDocType(dt.id)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all"
                        style={docType === dt.id ? { borderColor: GC, background: GL } : {}}
                        onMouseEnter={e => { if (docType !== dt.id) (e.currentTarget as HTMLElement).style.borderColor = GC }}
                        onMouseLeave={e => { if (docType !== dt.id) (e.currentTarget as HTMLElement).style.borderColor = '' }}>
                        <span className="text-base">{dt.icon}</span>
                        <div><p className="text-[10px] font-medium text-[var(--text)]">{dt.label}</p><p className="text-[9px] text-[var(--text-secondary)]">{dt.desc}</p></div>
                      </button>
                    ))}
                  </div>
                  {docType && (
                    <>
                      <textarea value={docCtx} onChange={e => setDocCtx(e.target.value)}
                        placeholder="Contexte supplémentaire (optionnel)…" rows={2}
                        className="w-full text-xs rounded-lg border border-[var(--border)] px-2 py-1.5 bg-[var(--surface)] text-[var(--text)] focus:outline-none resize-none mb-2"
                        onFocus={e => (e.currentTarget.style.borderColor = GC)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
                      <div className="flex gap-2">
                        <button onClick={generateDocument} disabled={genDoc}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
                          style={{ background: GC }}>
                          {genDoc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {genDoc ? 'Génération…' : 'Générer'}
                        </button>
                        {docResult && (
                          <button onClick={downloadDocument} className="p-2 rounded-lg border border-[var(--border)] hover:border-[#16A34A] transition-colors" title="Télécharger">
                            <Download size={14} style={{ color: GC }} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {docResult && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 max-h-40 overflow-y-auto">
                      <pre className="text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">{docResult}</pre>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Analyser un fichier</p>
                  <div onClick={() => fileInput.current?.click()}
                    className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center cursor-pointer transition-all"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GC; (e.currentTarget as HTMLElement).style.background = GL }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = '' }}>
                    <Upload size={18} className="mx-auto mb-1" style={{ color: GC }} />
                    <p className="text-xs font-medium text-[var(--text)]">{uploadFile ? uploadFile.name : 'Glisser ou cliquer'}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">PDF, Excel, Word, Image</p>
                    {uploadFile && (
                      <button onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadResult('') }}
                        className="mt-1 text-[10px] text-red-500 flex items-center gap-0.5 mx-auto">
                        <Trash2 size={10} /> Supprimer
                      </button>
                    )}
                  </div>
                  {uploadFile && (
                    <>
                      <textarea value={uploadQ} onChange={e => setUploadQ(e.target.value)} rows={2}
                        placeholder="Question sur le fichier…"
                        className="w-full mt-2 text-xs rounded-lg border border-[var(--border)] px-2 py-1.5 bg-[var(--surface)] text-[var(--text)] focus:outline-none resize-none"
                        onFocus={e => (e.currentTarget.style.borderColor = GC)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
                      <button onClick={analyzeFile} disabled={uploadLoading}
                        className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                        style={{ background: GC }}>
                        {uploadLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {uploadLoading ? 'Analyse en cours…' : 'Analyser avec MIAA+'}
                      </button>
                    </>
                  )}
                  {uploadResult && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 max-h-48 overflow-y-auto">
                      <pre className="text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">{uploadResult}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RAPPORTS ──────────────────────────────────────────────── */}
            {activeTab === 'rapports' && (
              <div className="flex flex-col h-full overflow-y-auto p-3 space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rapports générés</p>
                {rapports.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart2 size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-xs text-[var(--text-secondary)]">Aucun rapport disponible.</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">Générez votre premier rapport dans Documents.</p>
                    <button onClick={() => setActiveTab('documents')} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ background: GC }}>
                      Générer un rapport
                    </button>
                  </div>
                ) : rapports.map((r, i) => (
                  <div key={i} onClick={() => setSelRapport(selRapport === i ? null : i)}
                    className="p-3 rounded-xl border border-[var(--border)] cursor-pointer transition-all"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = GC}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = ''}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[var(--text)]">{r.type}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <ExternalLink size={12} className="text-[var(--text-secondary)]" />
                    </div>
                    {selRapport === i && <pre className="mt-2 text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">{r.contenu}</pre>}
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--border)]">
                  <Link href="/dashboard/miaa"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:border-[#16A34A] transition-all">
                    <ExternalLink size={12} /> Voir tous les rapports MIAA+
                  </Link>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                ── ACADEMY ────────────────────────────────────────────────
                ══════════════════════════════════════════════════════════ */}
            {activeTab === 'formation' && (
              <div className="flex flex-col h-full">

                {/* ── ACCUEIL ACADEMY ─────────────────────────────────── */}
                {acScreen === 'home' && (
                  <div className="flex-1 overflow-y-auto">
                    {/* Hero */}
                    <div className="px-4 py-4 text-center" style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)' }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: GGR }}>
                        <GraduationCap size={22} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-[var(--text)]">MIAA+ Academy</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {sectorInfo ? `Formations ${sectorInfo.metier}` : 'Votre université intégrée — du débutant à l\'expert'}
                      </p>
                    </div>

                    {/* Formations recommandées pour votre secteur */}
                    {sectorCats.length > 0 && (
                      <div className="px-3 pb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GD }}>
                          🎯 Recommandé pour votre activité — {sectorInfo?.metier}
                        </p>
                        <div className="space-y-1.5">
                          {sectorCats.slice(0, 3).map((catId, idx) => (
                            <button key={catId}
                              onClick={() => { setAcCat(catId); setAcScreen('level') }}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all"
                              style={{ borderColor: idx === 0 ? catColor(catId) : `${catColor(catId)}60`, background: idx === 0 ? `${catColor(catId)}12` : `${catColor(catId)}06` }}>
                              <span className="text-xl">{catIcon(catId)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--text)]">{catLabel(catId)}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] truncate">{todayTopic(catId)}</p>
                              </div>
                              {idx === 0 && (
                                <span className="text-[9px] font-bold px-2 py-1 rounded-full text-white shrink-0" style={{ background: catColor(catId) }}>
                                  AUJOURD&apos;HUI
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cours recommandé du jour (fallback sans secteur) */}
                    {sectorCats.length === 0 && recommendedCat && (
                      <div className="px-3 pb-2">
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">⭐ Cours du jour recommandé</p>
                        <button
                          onClick={() => { setAcCat(recommendedCat); setAcScreen('level') }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                          style={{ borderColor: catColor(recommendedCat), background: `${catColor(recommendedCat)}10` }}>
                          <span className="text-2xl">{catIcon(recommendedCat)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[var(--text)]">{catLabel(recommendedCat)}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] truncate">{todayTopic(recommendedCat)}</p>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-1 rounded-full text-white shrink-0" style={{ background: catColor(recommendedCat) }}>AUJOURD&apos;HUI</span>
                        </button>
                      </div>
                    )}

                    {/* Grille des 22 catégories */}
                    <div className="px-3 pb-4">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Toutes les formations disponibles</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ACADEMY_CATS.map(cat => (
                          <button key={cat.id}
                            onClick={() => { setAcCat(cat.id); setAcScreen('level') }}
                            className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--border)] text-left transition-all hover:shadow-sm"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color; (e.currentTarget as HTMLElement).style.background = `${cat.color}10` }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = '' }}>
                            <span className="text-xl leading-none">{cat.icon}</span>
                            <p className="text-[10px] font-medium text-[var(--text)] leading-tight line-clamp-2">{cat.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SÉLECTION NIVEAU ────────────────────────────────── */}
                {acScreen === 'level' && (
                  <div className="flex-1 overflow-y-auto">
                    {/* Header catégorie */}
                    <div className="px-3 py-3 flex items-center gap-2 border-b border-[var(--border)]">
                      <button onClick={() => setAcScreen('home')} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors">
                        <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                      </button>
                      <span className="text-xl">{catIcon(acCat)}</span>
                      <div>
                        <p className="text-xs font-bold text-[var(--text)]">{catLabel(acCat)}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">Cours du jour : {todayTopic(acCat)}</p>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-sm font-bold text-[var(--text)] mb-1">Quel est votre niveau ?</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mb-4">MIAA+ adapte le cours et les exercices à votre niveau.</p>
                      <div className="space-y-2.5">
                        {LEVELS.map(lvl => (
                          <button key={lvl.id} onClick={() => { setAcLevel(lvl.id); startLearning() }}
                            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-[var(--border)] text-left transition-all hover:shadow-md"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GC; (e.currentTarget as HTMLElement).style.background = GL }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = '' }}>
                            <span className="text-2xl">{lvl.icon}</span>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[var(--text)]">{lvl.label}</p>
                              <p className="text-[11px] text-[var(--text-secondary)]">{lvl.desc}</p>
                            </div>
                            <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── COURS + CHAT FORMATEUR ───────────────────────────── */}
                {acScreen === 'learning' && (
                  <div className="flex flex-col h-full">
                    {/* Header cours */}
                    <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)] shrink-0" style={{ background: GL }}>
                      <button onClick={() => setAcScreen('level')} className="p-1 rounded-lg hover:bg-white transition-colors">
                        <ChevronLeft size={13} className="text-[var(--text-secondary)]" />
                      </button>
                      <span className="text-lg">{catIcon(acCat)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text)] truncate">{todayTopic(acCat)}</p>
                        <p className="text-[9px] text-[var(--text-secondary)]">{catLabel(acCat)} · {LEVELS.find(l=>l.id===acLevel)?.label}</p>
                      </div>
                      <button onClick={startQuiz}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white transition-all"
                        style={{ background: GC }}>
                        <Trophy size={10} /> Quiz
                      </button>
                    </div>

                    {/* Messages formateur */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                      {acMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {m.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-1.5 mt-0.5" style={{ background: GGR }}>
                              <BookOpen size={10} className="text-white" />
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'text-white rounded-br-sm'
                              : 'text-[var(--text)] border rounded-bl-sm bg-[var(--surface)]'
                          }`} style={
                            m.role === 'user' ? { background: GC } : { borderColor: `${GC}40`, background: GL }
                          }>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            <span className="text-[9px] opacity-60 mt-0.5 block">{m.timestamp}</span>
                          </div>
                        </div>
                      ))}
                      {acSending && (
                        <div className="flex items-end gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: GGR }}>
                            <BookOpen size={10} className="text-white" />
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-sm border" style={{ borderColor: `${GC}40`, background: GL }}>
                            {[0,1,2].map(i => (
                              <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: GC }}
                                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }} />
                            ))}
                          </div>
                        </div>
                      )}
                      <div ref={acBottom} />
                    </div>

                    {/* Input formateur */}
                    <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: `${GC}30`, background: `${GL}` }}>
                      <div className="flex items-end gap-2">
                        <textarea value={acInput} onChange={e => setAcInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAcMessage() } }}
                          placeholder="Posez une question au formateur…" rows={1}
                          className="flex-1 resize-none rounded-xl border px-3 py-2 text-xs bg-white text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none transition-colors"
                          style={{ maxHeight: '72px', borderColor: `${GC}60` }}
                          onFocus={e => (e.currentTarget.style.borderColor = GC)}
                          onBlur={e => (e.currentTarget.style.borderColor = `${GC}60`)}
                        />
                        <button onClick={sendAcMessage} disabled={!acInput.trim() || acSending}
                          className="p-2 rounded-xl text-white shrink-0 transition-all disabled:opacity-40"
                          style={{ background: GC }}>
                          <Send size={14} />
                        </button>
                      </div>
                      <p className="text-[9px] text-center mt-1" style={{ color: GD }}>MIAA+ enseigne en mode formateur expert</p>
                    </div>
                  </div>
                )}

                {/* ── QUIZ ────────────────────────────────────────────── */}
                {acScreen === 'quiz' && !quizDone && (
                  <div className="flex flex-col h-full">
                    <div className="px-3 py-3 border-b border-[var(--border)] shrink-0" style={{ background: GL }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[var(--text)]">Quiz — {catLabel(acCat)}</p>
                        <span className="text-[11px] font-medium" style={{ color: GC }}>{quizIdx + 1} / {quizQuestions.length}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: GGR }}
                          animate={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }}
                          transition={{ duration: 0.4 }} />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <p className="text-sm font-semibold text-[var(--text)] leading-snug mb-4">{quizQuestions[quizIdx].q}</p>
                      <div className="space-y-2">
                        {quizQuestions[quizIdx].opts.map((opt, i) => {
                          const correct = quizQuestions[quizIdx].ans === i
                          const selected = quizSel === i
                          const showResult = quizSel !== null
                          return (
                            <button key={i} onClick={() => answerQuiz(i)}
                              disabled={quizSel !== null}
                              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all text-xs font-medium"
                              style={{
                                borderColor: showResult
                                  ? correct ? GC : selected ? '#DC2626' : 'var(--border)'
                                  : 'var(--border)',
                                background: showResult
                                  ? correct ? GL : selected ? '#FEF2F2' : 'var(--surface)'
                                  : selected ? GL : 'var(--surface)',
                                color: 'var(--text)',
                              }}>
                              <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[11px] font-bold"
                                style={{ borderColor: showResult && correct ? GC : showResult && selected ? '#DC2626' : 'var(--border)' }}>
                                {showResult && correct ? '✓' : showResult && selected && !correct ? '✗' : String.fromCharCode(65 + i)}
                              </span>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── RÉSULTAT / CERTIFICAT ────────────────────────────── */}
                {acScreen === 'result' && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="text-center mb-4">
                      {quizScore >= 4 ? (
                        <>
                          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: GGR }}>
                            <Award size={28} className="text-white" />
                          </div>
                          <p className="text-base font-bold text-[var(--text)]">Félicitations !</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{quizScore}/{quizQuestions.length} bonnes réponses</p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-amber-100">
                            <RotateCcw size={28} className="text-amber-600" />
                          </div>
                          <p className="text-base font-bold text-[var(--text)]">Continue tes efforts !</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{quizScore}/{quizQuestions.length} bonnes réponses</p>
                        </>
                      )}
                    </div>

                    {/* Certificat */}
                    {quizScore >= 4 && (
                      <div className="rounded-2xl border-2 p-4 mb-4 text-center" style={{ borderColor: GC, background: GL }}>
                        <div className="flex justify-center gap-1 mb-2">
                          {[...Array(quizScore)].map((_, i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}
                          {[...Array(quizQuestions.length - quizScore)].map((_, i) => <span key={i} className="text-gray-300 text-sm">★</span>)}
                        </div>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: GD }}>Certificat d&apos;Accomplissement</p>
                        <p className="text-xs font-bold text-[var(--text)] mb-0.5">{catLabel(acCat)}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mb-2">Niveau : {LEVELS.find(l=>l.id===acLevel)?.label}</p>
                        <p className="text-[9px] text-[var(--text-secondary)]">Délivré par MIAA+ Academy · Oraforme · {new Date().toLocaleDateString('fr-FR')}</p>
                        <div className="mt-2 flex items-center justify-center gap-1" style={{ color: GC }}>
                          <CheckCircle2 size={14} />
                          <span className="text-[10px] font-bold">Validé avec {Math.round((quizScore/quizQuestions.length)*100)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2">
                      <button onClick={() => { setAcScreen('learning') }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-medium"
                        style={{ background: GGR }}>
                        <BookOpen size={13} /> Continuer la formation
                      </button>
                      <button onClick={startQuiz}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border"
                        style={{ borderColor: GC, color: GC, background: GL }}>
                        <RotateCcw size={13} /> Refaire le quiz
                      </button>
                      <button onClick={() => { setAcScreen('home'); setAcCat(''); setAcMessages([]) }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)]">
                        Choisir une autre formation
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
            {/* ── FIN ACADEMY ─────────────────────────────────────────── */}

          </div>
        </div>
      )}
    </>
  )
}
