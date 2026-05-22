export type AccountCode = string

export type OhadaAccount = {
  number: AccountCode
  name: string
  type: 'actif' | 'passif' | 'charge' | 'produit' | 'tresorerie' | 'capitaux' | 'immobilisation' | 'stock'
  classe: 1 | 2 | 3 | 4 | 5 | 6 | 7
  sens: 'debit' | 'credit'  // solde normal
}

// ── OHADA Plan comptable SYSCOHADA — Classes 1 à 7 ───────────────────────────
export const OHADA_ACCOUNTS: OhadaAccount[] = [
  // ─── CLASSE 1 — Ressources durables ────────────────────────────────────────
  { number: '101000', name: 'Capital social',                          type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '104000', name: "Primes d'émission",                       type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '105000', name: 'Écarts de réévaluation',                  type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '106000', name: 'Réserves',                                type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '110000', name: 'Report à nouveau (solde créditeur)',       type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '119000', name: 'Report à nouveau (solde débiteur)',        type: 'capitaux',       classe: 1, sens: 'debit'  },
  { number: '120000', name: 'Résultat net — exercice bénéficiaire',    type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '129000', name: 'Résultat net — exercice déficitaire',     type: 'capitaux',       classe: 1, sens: 'debit'  },
  { number: '141000', name: 'Subventions équipement',                  type: 'capitaux',       classe: 1, sens: 'credit' },
  { number: '161000', name: 'Emprunts obligataires',                   type: 'passif',         classe: 1, sens: 'credit' },
  { number: '162000', name: 'Emprunts et dettes auprès des établissements de crédit', type: 'passif', classe: 1, sens: 'credit' },
  { number: '164000', name: 'Dettes de location-financement',          type: 'passif',         classe: 1, sens: 'credit' },
  { number: '165000', name: 'Dépôts et cautionnements reçus',          type: 'passif',         classe: 1, sens: 'credit' },
  { number: '168000', name: 'Autres dettes financières',               type: 'passif',         classe: 1, sens: 'credit' },

  // ─── CLASSE 2 — Actif immobilisé ────────────────────────────────────────────
  { number: '211000', name: 'Frais de développement',                  type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '212000', name: 'Brevets, licences, logiciels',            type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '213000', name: 'Fonds commercial',                        type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '221000', name: 'Terrains (bâtis)',                        type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '222000', name: 'Terrains (non bâtis)',                    type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '231000', name: 'Bâtiments (sur sol propre)',              type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '232000', name: 'Bâtiments (sur sol autre)',               type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '241000', name: 'Matériel et outillage industriel',        type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '244000', name: 'Matériel de bureau et mobilier',          type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '245000', name: 'Matériel de transport',                   type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '246000', name: 'Matériel informatique',                   type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '271000', name: 'Titres de participation',                 type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '272000', name: 'Autres titres immobilisés',               type: 'immobilisation', classe: 2, sens: 'debit'  },
  { number: '281000', name: 'Amort. immobilisations incorporelles',    type: 'immobilisation', classe: 2, sens: 'credit' },
  { number: '284000', name: 'Amort. matériel et outillage',            type: 'immobilisation', classe: 2, sens: 'credit' },
  { number: '285000', name: 'Amort. matériel de transport',            type: 'immobilisation', classe: 2, sens: 'credit' },
  { number: '286000', name: 'Amort. matériel informatique',            type: 'immobilisation', classe: 2, sens: 'credit' },

  // ─── CLASSE 3 — Stocks ──────────────────────────────────────────────────────
  { number: '301000', name: 'Marchandises',                            type: 'stock',          classe: 3, sens: 'debit'  },
  { number: '302000', name: 'Emballages commerciaux',                  type: 'stock',          classe: 3, sens: 'debit'  },
  { number: '321000', name: 'Matières premières',                      type: 'stock',          classe: 3, sens: 'debit'  },
  { number: '322000', name: 'Matières et fournitures consommables',    type: 'stock',          classe: 3, sens: 'debit'  },
  { number: '351000', name: 'Produits finis',                          type: 'stock',          classe: 3, sens: 'debit'  },
  { number: '361000', name: 'Produits intermédiaires',                 type: 'stock',          classe: 3, sens: 'debit'  },

  // ─── CLASSE 4 — Tiers ────────────────────────────────────────────────────────
  { number: '401000', name: 'Fournisseurs',                            type: 'passif',         classe: 4, sens: 'credit' },
  { number: '403000', name: 'Fournisseurs — effets à payer',           type: 'passif',         classe: 4, sens: 'credit' },
  { number: '408000', name: 'Fournisseurs — factures non parvenues',   type: 'passif',         classe: 4, sens: 'credit' },
  { number: '409000', name: 'Fournisseurs débiteurs — avances versées',type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '411000', name: 'Clients',                                  type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '412000', name: 'Clients — effets à recevoir',             type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '413000', name: 'Clients — factures à établir',            type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '419000', name: 'Clients créditeurs — avances reçues',     type: 'passif',         classe: 4, sens: 'credit' },
  { number: '421000', name: 'Personnel — Rémunérations dues',          type: 'passif',         classe: 4, sens: 'credit' },
  { number: '422000', name: 'Personnel — Avances et acomptes',         type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '424000', name: 'Personnel — Œuvres sociales',             type: 'passif',         classe: 4, sens: 'credit' },
  { number: '425000', name: 'Personnel — Dépôts reçus',                type: 'passif',         classe: 4, sens: 'credit' },
  { number: '431000', name: 'CNSS — Sécurité sociale',                 type: 'passif',         classe: 4, sens: 'credit' },
  { number: '432000', name: 'Mutuelles et autres organismes sociaux',  type: 'passif',         classe: 4, sens: 'credit' },
  { number: '441000', name: 'État — TVA collectée',                    type: 'passif',         classe: 4, sens: 'credit' },
  { number: '442000', name: 'État — TVA déductible',                   type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '443000', name: 'État — TVA facturée',                     type: 'passif',         classe: 4, sens: 'credit' },
  { number: '444000', name: 'État — TVA à décaisser',                  type: 'passif',         classe: 4, sens: 'credit' },
  { number: '445000', name: 'État — TVA à récupérer',                  type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '447000', name: 'État — Impôts et taxes divers',           type: 'passif',         classe: 4, sens: 'credit' },
  { number: '448000', name: 'État — Charges fiscales sur congés',      type: 'passif',         classe: 4, sens: 'credit' },
  { number: '449000', name: 'État — Autres créances et dettes fiscales',type: 'actif',         classe: 4, sens: 'debit'  },
  { number: '461000', name: 'Débiteurs divers',                        type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '462000', name: 'Créditeurs divers',                       type: 'passif',         classe: 4, sens: 'credit' },
  { number: '471000', name: 'Comptes de liaison — siège',              type: 'passif',         classe: 4, sens: 'credit' },
  { number: '476000', name: 'Charges constatées d\'avance',             type: 'actif',          classe: 4, sens: 'debit'  },
  { number: '477000', name: 'Produits constatés d\'avance',             type: 'passif',         classe: 4, sens: 'credit' },
  { number: '481000', name: 'Fournisseurs d\'immobilisations',          type: 'passif',         classe: 4, sens: 'credit' },
  { number: '485000', name: 'Versements restant à effectuer sur titres',type: 'passif',        classe: 4, sens: 'credit' },
  { number: '491000', name: 'Dépréciations des comptes clients',       type: 'actif',          classe: 4, sens: 'credit' },

  // ─── CLASSE 5 — Trésorerie ───────────────────────────────────────────────────
  { number: '511000', name: 'Effets à encaisser',                      type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '512000', name: 'Chèques à encaisser',                     type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521000', name: 'Banque — compte principal',               type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521001', name: 'Banque — BGFI Congo',                     type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521002', name: 'Banque — ECOBANK Congo',                  type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521003', name: 'Banque — LCB Bank',                       type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521004', name: 'Banque — Crédit du Congo',                type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521100', name: 'Mobile Money — MTN MoMo',                 type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '521101', name: 'Mobile Money — Airtel Money',             type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '531000', name: 'CCP / Chèques postaux',                   type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '551000', name: 'Crédits de trésorerie (découvert bancaire)',type:'passif',         classe: 5, sens: 'credit' },
  { number: '571000', name: 'Caisse (principale)',                      type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '571001', name: 'Caisse — Bureau principal',               type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '571002', name: 'Caisse — Agence secondaire',              type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '576000', name: 'Virements internes',                      type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '581000', name: 'Virements de fonds',                      type: 'tresorerie',     classe: 5, sens: 'debit'  },
  { number: '591000', name: 'Dépréciations des titres de placement',   type: 'tresorerie',     classe: 5, sens: 'credit' },

  // ─── CLASSE 6 — Charges ─────────────────────────────────────────────────────
  { number: '601000', name: 'Achats de marchandises',                  type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '602000', name: 'Achats de matières premières',            type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '604000', name: 'Achats de fournitures non stockées',      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '605000', name: 'Achats de matériel et équipements',       type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '606000', name: 'Achats de carburant et lubrifiants',      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '611000', name: 'Transports sur achats',                   type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '612000', name: 'Transports sur ventes',                   type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '613000', name: 'Locations et charges locatives',          type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '614000', name: 'Charges locatives et de copropriété',     type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '615000', name: 'Entretien et réparations',                type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '616000', name: 'Primes d\'assurance',                      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '618000', name: 'Documentation et bibliothèque',           type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '621000', name: 'Personnel extérieur à l\'entreprise',      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '622000', name: 'Rémunérations d\'intermédiaires',          type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '623000', name: 'Publicité, publications, relations publiques', type: 'charge',    classe: 6, sens: 'debit'  },
  { number: '624000', name: 'Transports de biens et transports collectifs', type: 'charge',   classe: 6, sens: 'debit'  },
  { number: '625000', name: 'Déplacements, missions et réceptions',    type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '626000', name: 'Frais postaux et de télécommunications',  type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '627000', name: 'Services bancaires et assimilés',         type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '628000', name: 'Divers (charges)',                        type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '631000', name: 'Impôts et taxes sur rémunérations',       type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '632000', name: 'Retenues et cotisations obligatoires',    type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '633000', name: 'Impôts fonciers',                         type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '634000', name: 'Taxes sur le chiffre d\'affaires',         type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '635000', name: 'Autres impôts et taxes',                  type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '641000', name: 'Rémunérations du personnel',              type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '643000', name: 'Indemnités et avantages divers',          type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '644000', name: 'Charges sociales patronales (CNSS)',       type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '645000', name: 'Indemnités de formation et apprentissage', type: 'charge',        classe: 6, sens: 'debit'  },
  { number: '651000', name: 'Charges locatives et loyers',             type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '652000', name: 'Redevances pour concessions',             type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '654000', name: 'Pertes sur créances irrécouvrables',      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '655000', name: 'Quotes-parts de résultat — opérations faites en commun', type: 'charge', classe: 6, sens: 'debit' },
  { number: '657000', name: 'Charges des exercices antérieurs',        type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '661000', name: 'Intérêts des emprunts',                   type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '664000', name: 'Dividendes versés',                       type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '665000', name: 'Escomptes accordés',                      type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '671000', name: 'Subventions accordées',                   type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '672000', name: 'Dons, libéralités et mécénat',            type: 'charge',         classe: 6, sens: 'debit'  },
  { number: '681000', name: 'Dotations aux amortissements — immobilisations', type: 'charge', classe: 6, sens: 'debit'  },
  { number: '691000', name: 'Impôts sur les bénéfices (IS)',           type: 'charge',         classe: 6, sens: 'debit'  },

  // ─── CLASSE 7 — Produits ─────────────────────────────────────────────────────
  { number: '701000', name: 'Ventes de marchandises (principal)',       type: 'produit',        classe: 7, sens: 'credit' },
  { number: '702000', name: 'Ventes de produits finis',                type: 'produit',        classe: 7, sens: 'credit' },
  { number: '703000', name: 'Ventes de produits résiduels',            type: 'produit',        classe: 7, sens: 'credit' },
  { number: '704000', name: 'Travaux facturés',                        type: 'produit',        classe: 7, sens: 'credit' },
  { number: '705000', name: 'Études et recherches facturées',          type: 'produit',        classe: 7, sens: 'credit' },
  { number: '706000', name: 'Prestations de services',                 type: 'produit',        classe: 7, sens: 'credit' },
  { number: '707000', name: 'Ventes de marchandises',                  type: 'produit',        classe: 7, sens: 'credit' },
  { number: '708000', name: 'Transport facturé',                       type: 'produit',        classe: 7, sens: 'credit' },
  { number: '709000', name: "Autres produits d'exploitation",          type: 'produit',        classe: 7, sens: 'credit' },
  { number: '711000', name: 'Variation de stocks — marchandises',      type: 'produit',        classe: 7, sens: 'credit' },
  { number: '714000', name: 'Production immobilisée',                  type: 'produit',        classe: 7, sens: 'credit' },
  { number: '721000', name: 'Subventions d\'exploitation reçues',       type: 'produit',        classe: 7, sens: 'credit' },
  { number: '741000', name: 'Produits financiers sur titres',          type: 'produit',        classe: 7, sens: 'credit' },
  { number: '746000', name: 'Gains de change',                         type: 'produit',        classe: 7, sens: 'credit' },
  { number: '752000', name: 'Revenus des immeubles non affectés à l\'exploitation', type: 'produit', classe: 7, sens: 'credit' },
  { number: '761000', name: 'Reprises sur provisions',                 type: 'produit',        classe: 7, sens: 'credit' },
  { number: '771000', name: 'Profits sur cessions d\'immobilisations',  type: 'produit',        classe: 7, sens: 'credit' },
  { number: '778000', name: 'Autres produits exceptionnels',           type: 'produit',        classe: 7, sens: 'credit' },
  { number: '781000', name: 'Reprises sur amortissements',             type: 'produit',        classe: 7, sens: 'credit' },
]

// ── Mapping comptes par {type opération, catégorie} → [débit, crédit] ─────────
const ACCOUNT_MAP: Record<string, Record<string, [AccountCode, AccountCode]>> = {
  entree: {
    'Vente':                ['571000', '707000'],
    'Ventes marchandises':  ['571000', '707000'],
    'Prestation services':  ['571000', '706000'],
    'Prestation':           ['571000', '706000'],
    'Facture payée':        ['521000', '411000'],
    'Règlement client':     ['521000', '411000'],
    'Avance client':        ['419000', '411000'],
    'Scolarité':            ['571000', '706000'],
    'Frais scolarité':      ['571000', '706000'],
    'Virement reçu':        ['521000', '709000'],
    'Mobile Money':         ['521100', '707000'],
    'Remboursement':        ['571000', '409000'],
    'Subvention reçue':     ['521000', '721000'],
    'Produit financier':    ['521000', '741000'],
    'Revenu locatif':       ['521000', '752000'],
    '__default':            ['571000', '709000'],
  },
  sortie: {
    'Salaires':             ['641000', '421000'],
    'Salaires & CNSS':      ['641000', '421000'],
    'Rémunérations':        ['641000', '421000'],
    'CNSS':                 ['644000', '431000'],
    'Charges sociales':     ['644000', '431000'],
    'Loyer':                ['613000', '521000'],
    'Location bureaux':     ['613000', '521000'],
    'Achats':               ['601000', '401000'],
    'Achats marchandises':  ['601000', '401000'],
    'Matières premières':   ['602000', '401000'],
    'Fournitures':          ['604000', '571000'],
    'Carburant':            ['606000', '571000'],
    'Transport':            ['624000', '571000'],
    'Publicité':            ['623000', '521000'],
    'Téléphone/Internet':   ['626000', '521000'],
    'Assurances':           ['616000', '521000'],
    'Entretien':            ['615000', '571000'],
    'Frais bancaires':      ['627000', '521000'],
    'Taxes':                ['635000', '521000'],
    'Impôts':               ['635000', '521000'],
    'TVA décaissée':        ['447000', '521000'],
    'IS — Impôt sociétés':  ['691000', '521000'],
    'Amortissement':        ['681000', '284000'],
    'Dividendes':           ['664000', '521000'],
    'Intérêts emprunt':     ['661000', '521000'],
    'Pertes créances':      ['654000', '491000'],
    'Charges diverses':     ['628000', '571000'],
    '__default':            ['628000', '571000'],
  },
  transfert: {
    'Caisse → Banque':      ['521000', '571000'],
    'Banque → Caisse':      ['571000', '521000'],
    'Mobile → Banque':      ['521000', '521100'],
    'Banque → Mobile':      ['521100', '521000'],
    '__default':            ['576000', '576000'],
  },
}

export function resolveAccounts(
  type: 'entree' | 'sortie' | 'transfert',
  categorie: string,
): [AccountCode, AccountCode] {
  const map = ACCOUNT_MAP[type] ?? {}
  return map[categorie] ?? map['__default'] ?? ['571000', '709000']
}

export function accountLabel(number: AccountCode): string {
  const found = OHADA_ACCOUNTS.find(a => a.number === number)
  return found ? `${found.number} — ${found.name}` : number
}

export function accountsByClasse(classe: 1 | 2 | 3 | 4 | 5 | 6 | 7): OhadaAccount[] {
  return OHADA_ACCOUNTS.filter(a => a.classe === classe)
}

export function accountsByType(type: OhadaAccount['type']): OhadaAccount[] {
  return OHADA_ACCOUNTS.filter(a => a.type === type)
}

// Retourne les comptes actif (bilan actif SYSCOHADA)
export function getActifAccounts(): OhadaAccount[] {
  return OHADA_ACCOUNTS.filter(a =>
    ['actif', 'immobilisation', 'stock', 'tresorerie'].includes(a.type) && a.sens === 'debit'
  )
}

// Retourne les comptes passif + capitaux (bilan passif SYSCOHADA)
export function getPassifAccounts(): OhadaAccount[] {
  return OHADA_ACCOUNTS.filter(a =>
    ['passif', 'capitaux'].includes(a.type) && a.sens === 'credit'
  )
}

// ── Journal entry ─────────────────────────────────────────────────────────────

export type JournalEntryInput = {
  tenant_id: string
  date_operation: string
  libelle: string
  debit_account: AccountCode
  credit_account: AccountCode
  montant: number
  source?: string
  source_id?: string
  fiscal_year?: number
  created_by?: string
}

export async function createJournalEntry(entry: JournalEntryInput) {
  const { supabase } = await import('@/lib/supabase')
  const { error } = await supabase.from('journal_entries').insert({
    ...entry,
    fiscal_year: entry.fiscal_year ?? new Date(entry.date_operation).getFullYear(),
  })
  return { error }
}

// ── Exercice comptable ────────────────────────────────────────────────────────

export async function setOpeningBalance(params: {
  tenant_id: string
  annee: number
  solde_ouverture: number
}) {
  const { supabase } = await import('@/lib/supabase')
  const { error } = await supabase.from('fiscal_years').upsert(
    {
      tenant_id:       params.tenant_id,
      annee:           params.annee,
      solde_ouverture: params.solde_ouverture,
      date_ouverture:  `${params.annee}-01-01`,
    },
    { onConflict: 'tenant_id,annee' },
  )
  return { error }
}

export async function getOpeningBalance(tenant_id: string, annee: number): Promise<number> {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase
    .from('fiscal_years')
    .select('solde_ouverture')
    .eq('tenant_id', tenant_id)
    .eq('annee', annee)
    .maybeSingle()
  return data?.solde_ouverture ?? 0
}

// ── TVA Congo (18% + CA 5% sur TVA) ─────────────────────────────────────────

export const TVA_RATE = 0.18
export const CA_RATE = 0.05   // Contribution d'appui = 5% × TVA

export function calcTVA(ht: number): { ht: number; tva: number; ca: number; ttc: number } {
  const tva = ht * TVA_RATE
  const ca = tva * CA_RATE
  const ttc = ht + tva + ca
  return { ht, tva, ca, ttc }
}

export function htFromTTC(ttc: number): { ht: number; tva: number; ca: number } {
  const ht = ttc / (1 + TVA_RATE + TVA_RATE * CA_RATE)
  const tva = ht * TVA_RATE
  const ca = tva * CA_RATE
  return { ht, tva, ca }
}
