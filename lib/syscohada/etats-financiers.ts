// ─────────────────────────────────────────────────────────────────────────────
// États Financiers SYSCOHADA Révisé 2017
// Bilan + Compte de Résultat selon le Système Normal OHADA
// ─────────────────────────────────────────────────────────────────────────────

import { getCompte } from './plan-comptable'

export interface LigneEcriture {
  compte:  string   // numéro de compte
  debit:   number
  credit:  number
}

export interface SoldeCompte {
  numero:      string
  debitTotal:  number
  creditTotal: number
  solde:       number   // positif = débit, négatif = crédit
}

// ─── Calcul de solde par compte ───────────────────────────────────────────────

export function calculerSolde(ecritures: LigneEcriture[]): Map<string, SoldeCompte> {
  const map = new Map<string, SoldeCompte>()

  for (const e of ecritures) {
    const existing = map.get(e.compte) ?? {
      numero:      e.compte,
      debitTotal:  0,
      creditTotal: 0,
      solde:       0,
    }
    existing.debitTotal  += e.debit
    existing.creditTotal += e.credit
    existing.solde        = existing.debitTotal - existing.creditTotal
    map.set(e.compte, existing)
  }

  return map
}

// ─── Agréger un solde sur plusieurs préfixes de comptes ───────────────────────

function agregSolde(
  soldes: Map<string, SoldeCompte>,
  prefixes: string[],
  sensPositif: 'debit' | 'credit' = 'debit',
): number {
  let total = 0
  for (const [numero, s] of soldes) {
    if (prefixes.some(p => numero.startsWith(p))) {
      total += sensPositif === 'debit' ? s.solde : -s.solde
    }
  }
  return Math.round(total)
}

// ─────────────────────────────────────────────────────────────────────────────
// BILAN SYSCOHADA
// ─────────────────────────────────────────────────────────────────────────────

export interface LigneBilan {
  code:    string
  libelle: string
  brut:    number
  amort:   number
  net:     number
  netN1?:  number
}

export interface SectionBilan {
  titre:   string
  lignes:  LigneBilan[]
  total:   number
}

export interface Bilan {
  actif:       SectionBilan[]
  passif:      SectionBilan[]
  totalActif:  number
  totalPassif: number
  equilibre:   boolean
  exercice:    string
}

export function genererBilan(
  ecritures: LigneEcriture[],
  exercice: string,
): Bilan {
  const s = calculerSolde(ecritures)

  // Helper: solde débiteur positif = actif
  const actif = (prefixes: string[]) => agregSolde(s, prefixes, 'debit')
  // Helper: solde créditeur positif = passif
  const passif = (prefixes: string[]) => agregSolde(s, prefixes, 'credit')

  // ── ACTIF ──────────────────────────────────────────────────────────────────

  const actifImmo: LigneBilan[] = [
    { code: 'AE', libelle: 'Charges immobilisées', brut: actif(['20']), amort: passif(['281']), net: 0, netN1: 0 },
    { code: 'AF', libelle: 'Frais de développement et de prospection', brut: actif(['211']), amort: passif(['282']), net: 0, netN1: 0 },
    { code: 'AG', libelle: 'Brevets, licences, logiciels, marques', brut: actif(['212','213','214']), amort: passif(['284']), net: 0, netN1: 0 },
    { code: 'AH', libelle: 'Fonds commercial et droit au bail', brut: actif(['215','216']), amort: passif(['284']), net: 0, netN1: 0 },
    { code: 'AI', libelle: 'Autres immobilisations incorporelles', brut: actif(['218']), amort: passif(['284']), net: 0, netN1: 0 },
    { code: 'AJ', libelle: 'Terrains', brut: actif(['22']), amort: passif(['282']), net: 0, netN1: 0 },
    { code: 'AK', libelle: 'Bâtiments, installations et agencements', brut: actif(['23']), amort: passif(['286']), net: 0, netN1: 0 },
    { code: 'AL', libelle: 'Matériel, mobilier et actifs biologiques', brut: actif(['24']), amort: passif(['284','288']), net: 0, netN1: 0 },
    { code: 'AM', libelle: 'Matériel de transport', brut: actif(['245']), amort: passif(['284']), net: 0, netN1: 0 },
    { code: 'AN', libelle: 'Avances et acomptes sur immobilisations', brut: actif(['25']), amort: 0, net: 0, netN1: 0 },
    { code: 'AP', libelle: 'Titres de participation', brut: actif(['26']), amort: passif(['296']), net: 0, netN1: 0 },
    { code: 'AQ', libelle: 'Autres immobilisations financières', brut: actif(['27']), amort: passif(['298']), net: 0, netN1: 0 },
  ].map(l => ({ ...l, net: Math.max(0, l.brut - l.amort) }))

  const actifCirculant: LigneBilan[] = [
    { code: 'BA', libelle: 'Stocks de marchandises', brut: actif(['31']), amort: passif(['391']), net: 0, netN1: 0 },
    { code: 'BB', libelle: 'Stocks de matières premières et fournitures', brut: actif(['32','33']), amort: passif(['392']), net: 0, netN1: 0 },
    { code: 'BC', libelle: 'En-cours de production', brut: actif(['34','35']), amort: 0, net: 0, netN1: 0 },
    { code: 'BD', libelle: 'Stocks de produits finis', brut: actif(['36','37']), amort: passif(['396']), net: 0, netN1: 0 },
    { code: 'BF', libelle: 'Créances clients et comptes rattachés', brut: actif(['41']), amort: passif(['491']), net: 0, netN1: 0 },
    { code: 'BG', libelle: 'Autres créances', brut: actif(['47','48']), amort: 0, net: 0, netN1: 0 },
    { code: 'BH', libelle: 'TVA récupérable', brut: actif(['4445','4446','4447']), amort: 0, net: 0, netN1: 0 },
    { code: 'BI', libelle: 'Subventions à recevoir', brut: actif(['445']), amort: 0, net: 0, netN1: 0 },
  ].map(l => ({ ...l, net: Math.max(0, l.brut - l.amort) }))

  const tresorerie: LigneBilan[] = [
    { code: 'BQ', libelle: 'Titres de placement', brut: actif(['50']), amort: 0, net: 0, netN1: 0 },
    { code: 'BR', libelle: 'Valeurs à encaisser', brut: actif(['51']), amort: 0, net: 0, netN1: 0 },
    { code: 'BS', libelle: 'Banques, chèques postaux, Caisse', brut: actif(['52','53','57']), amort: 0, net: 0, netN1: 0 },
    { code: 'BT', libelle: 'Mobile money et monnaies électroniques', brut: actif(['54']), amort: 0, net: 0, netN1: 0 },
  ].map(l => ({ ...l, net: l.brut }))

  const totalActif = [
    ...actifImmo, ...actifCirculant, ...tresorerie
  ].reduce((sum, l) => sum + l.net, 0)

  // ── PASSIF ─────────────────────────────────────────────────────────────────

  const capitaux: LigneBilan[] = [
    { code: 'CA', libelle: 'Capital', brut: passif(['101']), amort: 0, net: 0 },
    { code: 'CB', libelle: 'Actionnaires — capital souscrit non appelé', brut: actif(['109']), amort: 0, net: 0 },
    { code: 'CD', libelle: 'Réserves', brut: passif(['11']), amort: 0, net: 0 },
    { code: 'CE', libelle: 'Report à nouveau', brut: passif(['121']) - actif(['129']), amort: 0, net: 0 },
    { code: 'CF', libelle: 'Résultat net de l\'exercice', brut: passif(['131']) - actif(['139']), amort: 0, net: 0 },
    { code: 'CG', libelle: 'Subventions d\'investissement', brut: passif(['14']), amort: 0, net: 0 },
    { code: 'CH', libelle: 'Provisions réglementées', brut: passif(['15']), amort: 0, net: 0 },
  ].map(l => ({ ...l, net: l.brut }))

  const dettesLT: LigneBilan[] = [
    { code: 'DA', libelle: 'Emprunts et dettes à LT', brut: passif(['16','17']), amort: 0, net: 0 },
    { code: 'DB', libelle: 'Dettes de crédit-bail', brut: passif(['164']), amort: 0, net: 0 },
    { code: 'DC', libelle: 'Provisions financières pour risques', brut: passif(['19']), amort: 0, net: 0 },
  ].map(l => ({ ...l, net: l.brut }))

  const passifCirculant: LigneBilan[] = [
    { code: 'EA', libelle: 'Dettes fournisseurs et comptes rattachés', brut: passif(['40']), amort: 0, net: 0 },
    { code: 'EB', libelle: 'Dettes fiscales (TVA + impôts)', brut: passif(['441','442','4441','446','447','448']), amort: 0, net: 0 },
    { code: 'EC', libelle: 'Dettes sociales (CNSS, personnel)', brut: passif(['42','43']), amort: 0, net: 0 },
    { code: 'ED', libelle: 'Autres dettes', brut: passif(['47','48']), amort: 0, net: 0 },
    { code: 'EE', libelle: 'Produits constatés d\'avance', brut: passif(['477']), amort: 0, net: 0 },
  ].map(l => ({ ...l, net: l.brut }))

  const totalPassif = [
    ...capitaux, ...dettesLT, ...passifCirculant
  ].reduce((sum, l) => sum + l.net, 0)

  const totalActifSection  = (lignes: LigneBilan[]) => lignes.reduce((s, l) => s + l.net, 0)

  return {
    actif: [
      { titre: 'ACTIF IMMOBILISÉ',    lignes: actifImmo,       total: totalActifSection(actifImmo) },
      { titre: 'ACTIF CIRCULANT',     lignes: actifCirculant,  total: totalActifSection(actifCirculant) },
      { titre: 'TRÉSORERIE — ACTIF',  lignes: tresorerie,      total: totalActifSection(tresorerie) },
    ],
    passif: [
      { titre: 'CAPITAUX PROPRES',                  lignes: capitaux,         total: totalActifSection(capitaux) },
      { titre: 'DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES', lignes: dettesLT, total: totalActifSection(dettesLT) },
      { titre: 'PASSIF CIRCULANT',                  lignes: passifCirculant,  total: totalActifSection(passifCirculant) },
    ],
    totalActif,
    totalPassif,
    equilibre: Math.abs(totalActif - totalPassif) < 10,
    exercice,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPTE DE RÉSULTAT SYSCOHADA
// ─────────────────────────────────────────────────────────────────────────────

export interface LigneResultat {
  code:     string
  libelle:  string
  charges:  number
  produits: number
}

export interface CompteResultat {
  lignes:          LigneResultat[]
  resultatAO:      number
  resultatHAO:     number
  resultatAvantIS: number
  is:              number
  resultatNet:     number
  chiffreAffaires: number
    valeurAjoutee:   number
  exercice:        string
}

export function genererCompteResultat(
  ecritures: LigneEcriture[],
  exercice: string,
): CompteResultat {
  const s = calculerSolde(ecritures)

  const ch = (prefixes: string[]) => agregSolde(s, prefixes, 'debit')
  const pr = (prefixes: string[]) => agregSolde(s, prefixes, 'credit')

  // Chiffre d'affaires
  const ventes       = pr(['701','702','703','704','705','706','707','708'])
  const subvExp      = pr(['711'])
  const ca           = ventes

  // Charges d'exploitation
  const achatsMarch  = ch(['601'])
  const achatsMatMP  = ch(['602'])
  const achatsAutres = ch(['604','605','608'])
  const transports   = ch(['61'])
  const servicesA    = ch(['62'])
  const servicesB    = ch(['63'])
  const impotsTaxes  = ch(['64'])
  const autCharges   = ch(['65'])
  const chargesPerso = ch(['66'])
  const dotationsAmo = ch(['68'])

  // Produits d'exploitation
  const prodImmo     = pr(['72'])
  const varStocks    = pr(['73'])
  const autProduits  = pr(['75'])
  const repriseProv  = pr(['78','79'])

  // Résultats financiers
  const chargesFinanc = ch(['67'])
  const produitsFinanc = pr(['77'])

  // HAO
  const chargesHAO   = ch(['81','83','85','87','89'])
  const produitsHAO  = pr(['82','84','86','88'])

  // IS
  const is           = ch(['695','691'])

  // Valeur ajoutée
  const consomProd   = achatsMarch + achatsMatMP + achatsAutres + transports + servicesA + servicesB
  const valeurAjoutee = ca + subvExp - consomProd

  const ebeMarge     = valeurAjoutee - chargesPerso - impotsTaxes

  const resultatAO = ventes + subvExp + prodImmo + varStocks + autProduits + repriseProv
    - achatsMarch - achatsMatMP - achatsAutres - transports - servicesA - servicesB
    - impotsTaxes - autCharges - chargesPerso - dotationsAmo
    + produitsFinanc - chargesFinanc

  const resultatHAO    = produitsHAO - chargesHAO
  const resultatAvantIS = resultatAO + resultatHAO
  const resultatNet     = resultatAvantIS - is

  const lignes: LigneResultat[] = [
    { code: 'TA', libelle: 'Ventes de marchandises (1)',               charges: 0,          produits: pr(['701']) },
    { code: 'RA', libelle: '(-) Achats de marchandises',              charges: achatsMarch, produits: 0 },
    { code: 'XA', libelle: '= MARGE COMMERCIALE',                     charges: 0,          produits: pr(['701']) - achatsMarch },
    { code: 'TB', libelle: 'Ventes de produits fabriqués (2)',         charges: 0,          produits: pr(['702','703']) },
    { code: 'TC', libelle: 'Travaux, services vendus (3)',             charges: 0,          produits: pr(['704','705','706']) },
    { code: 'TD', libelle: 'Produits accessoires (4)',                 charges: 0,          produits: pr(['708']) },
    { code: 'XB', libelle: 'CHIFFRE D\'AFFAIRES (1+2+3+4)',           charges: 0,          produits: ca },
    { code: 'TE', libelle: 'Production stockée (destockage)',          charges: 0,          produits: varStocks },
    { code: 'TF', libelle: 'Production immobilisée',                  charges: 0,          produits: prodImmo },
    { code: 'TG', libelle: 'Subventions d\'exploitation',             charges: 0,          produits: subvExp },
    { code: 'TH', libelle: 'Autres produits',                         charges: 0,          produits: autProduits },
    { code: 'TI', libelle: 'Reprises de provisions et amortissements', charges: 0,         produits: repriseProv },
    { code: 'RB', libelle: 'Achats de matières premières',            charges: achatsMatMP, produits: 0 },
    { code: 'RC', libelle: 'Autres achats et charges externes',       charges: achatsAutres + transports + servicesA + servicesB, produits: 0 },
    { code: 'RD', libelle: 'Impôts et taxes',                         charges: impotsTaxes, produits: 0 },
    { code: 'RE', libelle: 'Autres charges',                          charges: autCharges,  produits: 0 },
    { code: 'XC', libelle: 'VALEUR AJOUTÉE',                          charges: 0,          produits: valeurAjoutee },
    { code: 'RF', libelle: 'Charges de personnel',                    charges: chargesPerso, produits: 0 },
    { code: 'XD', libelle: 'EXCÉDENT BRUT D\'EXPLOITATION',          charges: 0,          produits: ebeMarge },
    { code: 'RG', libelle: 'Dotations aux amortissements et provisions', charges: dotationsAmo, produits: 0 },
    { code: 'XE', libelle: 'RÉSULTAT D\'EXPLOITATION',               charges: 0,          produits: resultatAO + chargesFinanc - produitsFinanc },
    { code: 'TJ', libelle: 'Revenus financiers',                      charges: 0,          produits: produitsFinanc },
    { code: 'RH', libelle: 'Frais financiers',                        charges: chargesFinanc, produits: 0 },
    { code: 'XF', libelle: 'RÉSULTAT FINANCIER',                      charges: 0,          produits: produitsFinanc - chargesFinanc },
    { code: 'XG', libelle: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES',      charges: 0,          produits: resultatAO },
    { code: 'TK', libelle: 'Produits hors activités ordinaires (HAO)', charges: 0,         produits: produitsHAO },
    { code: 'RI', libelle: 'Charges hors activités ordinaires (HAO)', charges: chargesHAO,  produits: 0 },
    { code: 'XH', libelle: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES',     charges: 0,          produits: resultatHAO },
    { code: 'RS', libelle: 'Impôts sur le résultat',                  charges: is,          produits: 0 },
    { code: 'XI', libelle: 'RÉSULTAT NET',                            charges: 0,          produits: resultatNet },
  ]

  return {
    lignes,
    resultatAO,
    resultatHAO,
    resultatAvantIS,
    is,
    resultatNet,
    chiffreAffaires: ca,
    valeurAjoutee,
    exercice,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLEAU DES FLUX DE TRÉSORERIE SYSCOHADA (Méthode indirecte)
// Codes officiels : ZA (activités), ZB (investissement), ZC (financement)
// ─────────────────────────────────────────────────────────────────────────────

export interface LigneFlux {
  code:    string
  libelle: string
  montant: number
}

export interface SectionFlux {
  code:    string
  titre:   string
  lignes:  LigneFlux[]
  total:   number
}

export interface FluxTresorerie {
  sections:        SectionFlux[]
  variationNette:  number
  tresoOuverture:  number
  tresoClôture:    number
  exercice:        string
}

// Somme des mouvements nets débiteurs sur les comptes dont le numéro
// commence par l'un des préfixes donnés.
// solde = debitTotal - creditTotal ; positif = compte débiteur net.
function netDb(soldes: Map<string, SoldeCompte>, prefixes: string[]): number {
  let t = 0
  for (const [num, s] of soldes) {
    if (prefixes.some(p => num.startsWith(p))) t += s.solde
  }
  return t
}

export function genererFluxTresorerie(
  ecritures: LigneEcriture[],
  exercice: string,
  resultatNet: number,   // passé depuis genererCompteResultat()
): FluxTresorerie {
  const s = calculerSolde(ecritures)

  // ── Section A — Activités ordinaires (méthode indirecte) ─────────────────
  const dotAmort   = netDb(s, ['68'])               // débits charges amort (positif = charge)
  const reprAmort  = -netDb(s, ['78'])              // crédits reprises (inversé : reprises sont créditées)
  const varStocks  = -netDb(s, ['31','32','33','34','35','36','37','38'])  // ↑ stocks = (-) flux
  const varCreances= -netDb(s, ['41'])              // ↑ créances = (-) flux
  const varFourn   = -netDb(s, ['40'])              // ↑ dettes four = (+) flux (net débit négatif)
  const varFiscal  = -netDb(s, ['44','448'])        // ↑ dettes fiscales = (+) flux
  const varSocial  = -netDb(s, ['42','43'])         // ↑ dettes sociales = (+) flux
  const varAutres  = -netDb(s, ['47','476','477'])  // charges/produits constatés d'avance

  const secA: LigneFlux[] = [
    { code: 'ZA1', libelle: 'Résultat net de l\'exercice',                   montant: resultatNet },
    { code: 'ZA2', libelle: '+ Dotations aux amortissements et provisions',  montant: dotAmort },
    { code: 'ZA3', libelle: '− Reprises sur amortissements et provisions',   montant: reprAmort },
    { code: 'ZA4', libelle: '± Variation des stocks',                        montant: varStocks },
    { code: 'ZA5', libelle: '± Variation des créances clients',              montant: varCreances },
    { code: 'ZA6', libelle: '± Variation des dettes fournisseurs',           montant: varFourn },
    { code: 'ZA7', libelle: '± Variation des dettes fiscales et sociales',   montant: varFiscal + varSocial },
    { code: 'ZA8', libelle: '± Autres variations du BFR',                    montant: varAutres },
  ]
  const totalA = secA.reduce((t, l) => t + l.montant, 0)

  // ── Section B — Investissement ───────────────────────────────────────────
  const acqIncorp  = -netDb(s, ['21','218'])          // acquisitions immo incorporelles
  const acqCorpBat = -netDb(s, ['22','23'])           // terrains + bâtiments
  const acqCorpMat = -netDb(s, ['24','25'])           // matériel + avances
  const prodCess   = -netDb(s, ['82'])                // produits de cessions (compte 82 est produit HAO, normalement crédité)
  const vcnCess    = netDb(s, ['81'])                 // VNC cessions (charge HAO, débitée)
  const acqFinanc  = -netDb(s, ['26','27'])           // titres + prêts accordés
  const divRecus   = -netDb(s, ['464'])               // dividendes à recevoir

  const secB: LigneFlux[] = [
    { code: 'ZB1', libelle: '− Acquisitions d\'immobilisations incorporelles',    montant: acqIncorp },
    { code: 'ZB2', libelle: '− Acquisitions d\'immobilisations corporelles',      montant: acqCorpBat + acqCorpMat },
    { code: 'ZB3', libelle: '+ Produits de cessions d\'immobilisations',          montant: prodCess - vcnCess },
    { code: 'ZB4', libelle: '± Acquisitions / cessions d\'actifs financiers',     montant: acqFinanc },
    { code: 'ZB5', libelle: '+ Dividendes reçus',                                montant: divRecus },
  ]
  const totalB = secB.reduce((t, l) => t + l.montant, 0)

  // ── Section C — Financement ──────────────────────────────────────────────
  const augCap     = -netDb(s, ['101','1011','1012','1013'])  // apports capital (crédités)
  const empNouv    = Math.max(0, -netDb(s, ['16','17']))      // nouveaux emprunts (flux credit net)
  const rembEmpr   = Math.min(0, -netDb(s, ['16','17']))      // remboursements (flux débit net)
  const divVerses  = -netDb(s, ['462'])                       // dividendes à payer (débit = paiement)

  const secC: LigneFlux[] = [
    { code: 'ZC1', libelle: '+ Augmentations de capital',          montant: augCap },
    { code: 'ZC2', libelle: '+ Nouveaux emprunts et dettes LT',    montant: empNouv },
    { code: 'ZC3', libelle: '− Remboursements d\'emprunts',        montant: rembEmpr },
    { code: 'ZC4', libelle: '− Dividendes versés aux actionnaires', montant: divVerses },
  ]
  const totalC = secC.reduce((t, l) => t + l.montant, 0)

  // ── Trésorerie nette ─────────────────────────────────────────────────────
  const variationNette = totalA + totalB + totalC

  // Trésorerie de clôture = solde comptes 5x (banques + caisses + mobile)
  const tresoClôture = netDb(s, ['51','52','53','54','57'])
  // Trésorerie d'ouverture = clôture - variation
  const tresoOuverture = tresoClôture - variationNette

  return {
    sections: [
      { code: 'ZA', titre: 'Flux nets de trésorerie des activités ordinaires',    lignes: secA, total: totalA },
      { code: 'ZB', titre: 'Flux nets de trésorerie des activités d\'investissement', lignes: secB, total: totalB },
      { code: 'ZC', titre: 'Flux nets de trésorerie des activités de financement', lignes: secC, total: totalC },
    ],
    variationNette,
    tresoOuverture,
    tresoClôture,
    exercice,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatage FCFA
// ─────────────────────────────────────────────────────────────────────────────

export function formatFCFA(val: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(val)) + ' FCFA'
}

export function classeResultat(val: number): 'positif' | 'negatif' | 'zero' {
  if (val > 0) return 'positif'
  if (val < 0) return 'negatif'
  return 'zero'
}
