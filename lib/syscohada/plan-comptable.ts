// ─────────────────────────────────────────────────────────────────────────────
// Plan Comptable SYSCOHADA Révisé 2017
// Système Comptable OHADA — Guide d'application 2017
// ─────────────────────────────────────────────────────────────────────────────

export type TypeCompte =
  | 'actif' | 'passif' | 'mixte'
  | 'charge' | 'produit'
  | 'charge_hao' | 'produit_hao'
  | 'analytique'

export interface CompteInfo {
  nom:  string
  type: TypeCompte
}

export interface ClasseInfo {
  nom:     string
  comptes: Record<string, CompteInfo>
}

export const PLAN_COMPTABLE_SYSCOHADA: Record<string, ClasseInfo> = {

  classe1: {
    nom: 'Ressources durables',
    comptes: {
      '10':   { nom: 'Capital', type: 'passif' },
      '101':  { nom: 'Capital social', type: 'passif' },
      '1011': { nom: 'Capital souscrit non appelé', type: 'passif' },
      '1012': { nom: 'Capital souscrit appelé non versé', type: 'passif' },
      '1013': { nom: 'Capital souscrit appelé versé', type: 'passif' },
      '109':  { nom: 'Actionnaires — capital souscrit non appelé', type: 'actif' },
      '11':   { nom: 'Réserves', type: 'passif' },
      '111':  { nom: 'Réserve légale', type: 'passif' },
      '112':  { nom: 'Réserves statutaires', type: 'passif' },
      '118':  { nom: 'Autres réserves', type: 'passif' },
      '12':   { nom: 'Report à nouveau', type: 'passif' },
      '121':  { nom: 'Report à nouveau créditeur', type: 'passif' },
      '129':  { nom: 'Report à nouveau débiteur', type: 'actif' },
      '13':   { nom: 'Résultat net de l\'exercice', type: 'mixte' },
      '131':  { nom: 'Résultat net : bénéfice', type: 'passif' },
      '139':  { nom: 'Résultat net : perte', type: 'actif' },
      '14':   { nom: 'Subventions d\'investissement', type: 'passif' },
      '141':  { nom: 'Subventions d\'équipement', type: 'passif' },
      '142':  { nom: 'Subventions d\'exploitation', type: 'passif' },
      '15':   { nom: 'Provisions réglementées et fonds assimilés', type: 'passif' },
      '16':   { nom: 'Emprunts et dettes assimilées', type: 'passif' },
      '161':  { nom: 'Emprunts obligataires', type: 'passif' },
      '162':  { nom: 'Emprunts et dettes auprès des associés', type: 'passif' },
      '163':  { nom: 'Autres emprunts', type: 'passif' },
      '164':  { nom: 'Dettes de crédit-bail et contrats assimilés', type: 'passif' },
      '165':  { nom: 'Dépôts et cautionnements reçus', type: 'passif' },
      '166':  { nom: 'Intérêts courus', type: 'passif' },
      '168':  { nom: 'Autres emprunts et dettes', type: 'passif' },
      '169':  { nom: 'Primes de remboursement des obligations', type: 'actif' },
      '17':   { nom: 'Dettes de crédit-bail et contrats assimilés', type: 'passif' },
      '18':   { nom: 'Dettes liées à des participations et comptes de liaison', type: 'passif' },
      '181':  { nom: 'Dettes de financement', type: 'passif' },
      '182':  { nom: 'Comptes de liaison des établissements', type: 'mixte' },
      '184':  { nom: 'Comptes de liaison des succursales', type: 'mixte' },
      '185':  { nom: 'Comptes de liaison des autres entités', type: 'mixte' },
      '19':   { nom: 'Provisions financières pour risques et charges', type: 'passif' },
      '191':  { nom: 'Provisions pour hausses des prix', type: 'passif' },
      '194':  { nom: 'Provisions pour pertes de change', type: 'passif' },
      '199':  { nom: 'Autres provisions financières', type: 'passif' },
    },
  },

  classe2: {
    nom: 'Actif immobilisé',
    comptes: {
      '20':   { nom: 'Charges immobilisées', type: 'actif' },
      '201':  { nom: 'Frais d\'établissement', type: 'actif' },
      '202':  { nom: 'Charges à répartir sur plusieurs exercices', type: 'actif' },
      '204':  { nom: 'Primes de remboursement des obligations', type: 'actif' },
      '21':   { nom: 'Immobilisations incorporelles', type: 'actif' },
      '211':  { nom: 'Frais de développement', type: 'actif' },
      '212':  { nom: 'Brevets, licences, logiciels', type: 'actif' },
      '213':  { nom: 'Logiciels et sites internet', type: 'actif' },
      '214':  { nom: 'Marques', type: 'actif' },
      '215':  { nom: 'Fonds commercial', type: 'actif' },
      '216':  { nom: 'Droit au bail', type: 'actif' },
      '217':  { nom: 'Coût d\'obtention du contrat', type: 'actif' },
      '218':  { nom: 'Autres immobilisations incorporelles', type: 'actif' },
      '22':   { nom: 'Terrains', type: 'actif' },
      '221':  { nom: 'Terrains agricoles et forestiers', type: 'actif' },
      '222':  { nom: 'Terrains nus', type: 'actif' },
      '223':  { nom: 'Terrains bâtis', type: 'actif' },
      '224':  { nom: 'Travaux de mise en valeur des terrains', type: 'actif' },
      '225':  { nom: 'Terrains de gisement', type: 'actif' },
      '228':  { nom: 'Autres terrains', type: 'actif' },
      '23':   { nom: 'Bâtiments, installations et agencements', type: 'actif' },
      '231':  { nom: 'Bâtiments sur sol propre', type: 'actif' },
      '232':  { nom: 'Bâtiments sur sol d\'autrui', type: 'actif' },
      '233':  { nom: 'Ouvrages d\'infrastructure', type: 'actif' },
      '234':  { nom: 'Installations techniques', type: 'actif' },
      '235':  { nom: 'Aménagements et agencements', type: 'actif' },
      '238':  { nom: 'Autres bâtiments et installations', type: 'actif' },
      '24':   { nom: 'Matériel', type: 'actif' },
      '241':  { nom: 'Matériel et outillage industriel', type: 'actif' },
      '242':  { nom: 'Matériel et outillage agricole', type: 'actif' },
      '243':  { nom: 'Matériel d\'emballage récupérable', type: 'actif' },
      '244':  { nom: 'Matériel et mobilier de bureau', type: 'actif' },
      '245':  { nom: 'Matériel de transport', type: 'actif' },
      '246':  { nom: 'Actifs biologiques', type: 'actif' },
      '247':  { nom: 'Matériel informatique', type: 'actif' },
      '248':  { nom: 'Autres matériels', type: 'actif' },
      '25':   { nom: 'Avances et acomptes versés sur immobilisations', type: 'actif' },
      '26':   { nom: 'Titres de participation', type: 'actif' },
      '261':  { nom: 'Titres de participation — entreprises associées', type: 'actif' },
      '265':  { nom: 'Titres de participation — autres sociétés', type: 'actif' },
      '266':  { nom: 'Autres formes de participations', type: 'actif' },
      '27':   { nom: 'Autres immobilisations financières', type: 'actif' },
      '271':  { nom: 'Prêts et créances non commerciales', type: 'actif' },
      '272':  { nom: 'Dépôts et cautionnements versés', type: 'actif' },
      '273':  { nom: 'Prêts au personnel', type: 'actif' },
      '274':  { nom: 'Créances sur cessions d\'immobilisations', type: 'actif' },
      '275':  { nom: 'Intérêts courus sur prêts', type: 'actif' },
      '276':  { nom: 'Dépôts pour risques en matière douanière', type: 'actif' },
      '278':  { nom: 'Autres créances financières', type: 'actif' },
      '28':   { nom: 'Amortissements', type: 'passif' },
      '281':  { nom: 'Amortissements des frais d\'établissement', type: 'passif' },
      '284':  { nom: 'Amortissements des immobilisations incorporelles', type: 'passif' },
      '286':  { nom: 'Amortissements des bâtiments', type: 'passif' },
      '288':  { nom: 'Amortissements des autres immobilisations', type: 'passif' },
      '29':   { nom: 'Dépréciations des immobilisations', type: 'passif' },
      '291':  { nom: 'Dépréciations des immobilisations incorporelles', type: 'passif' },
      '296':  { nom: 'Dépréciations des titres de participation', type: 'passif' },
      '298':  { nom: 'Dépréciations des autres immobilisations', type: 'passif' },
    },
  },

  classe3: {
    nom: 'Stocks',
    comptes: {
      '31':   { nom: 'Marchandises', type: 'actif' },
      '311':  { nom: 'Marchandises A', type: 'actif' },
      '312':  { nom: 'Marchandises B', type: 'actif' },
      '318':  { nom: 'Autres marchandises', type: 'actif' },
      '32':   { nom: 'Matières premières', type: 'actif' },
      '321':  { nom: 'Matières premières A', type: 'actif' },
      '322':  { nom: 'Matières premières B', type: 'actif' },
      '33':   { nom: 'Autres approvisionnements', type: 'actif' },
      '331':  { nom: 'Matières consommables', type: 'actif' },
      '332':  { nom: 'Fournitures de bureau', type: 'actif' },
      '333':  { nom: 'Emballages', type: 'actif' },
      '34':   { nom: 'Produits en cours', type: 'actif' },
      '341':  { nom: 'Produits en cours', type: 'actif' },
      '35':   { nom: 'Services en cours', type: 'actif' },
      '36':   { nom: 'Produits finis', type: 'actif' },
      '361':  { nom: 'Produits finis A', type: 'actif' },
      '362':  { nom: 'Produits finis B', type: 'actif' },
      '37':   { nom: 'Produits intermédiaires et résiduels', type: 'actif' },
      '38':   { nom: 'Stocks en cours de route', type: 'actif' },
      '39':   { nom: 'Dépréciations des stocks', type: 'passif' },
      '391':  { nom: 'Dépréciations des marchandises', type: 'passif' },
      '392':  { nom: 'Dépréciations des matières premières', type: 'passif' },
      '396':  { nom: 'Dépréciations des produits finis', type: 'passif' },
    },
  },

  classe4: {
    nom: 'Tiers',
    comptes: {
      '40':   { nom: 'Fournisseurs et comptes rattachés', type: 'passif' },
      '401':  { nom: 'Fournisseurs, dettes en compte', type: 'passif' },
      '402':  { nom: 'Fournisseurs, effets à payer', type: 'passif' },
      '404':  { nom: 'Fournisseurs d\'investissements', type: 'passif' },
      '408':  { nom: 'Fournisseurs, factures non parvenues', type: 'passif' },
      '409':  { nom: 'Fournisseurs débiteurs', type: 'actif' },
      '41':   { nom: 'Clients et comptes rattachés', type: 'actif' },
      '411':  { nom: 'Clients', type: 'actif' },
      '412':  { nom: 'Clients, effets à recevoir', type: 'actif' },
      '413':  { nom: 'Clients, retenues de garantie', type: 'actif' },
      '414':  { nom: 'Créances sur cessions courantes d\'immobilisations', type: 'actif' },
      '416':  { nom: 'Créances litigieuses ou douteuses', type: 'actif' },
      '418':  { nom: 'Clients, produits non encore facturés', type: 'actif' },
      '419':  { nom: 'Clients créditeurs', type: 'passif' },
      '42':   { nom: 'Personnel', type: 'mixte' },
      '421':  { nom: 'Personnel, avances et acomptes', type: 'actif' },
      '422':  { nom: 'Personnel, rémunérations dues', type: 'passif' },
      '423':  { nom: 'Personnel, oppositions', type: 'passif' },
      '424':  { nom: 'Personnel, œuvres sociales et syndicales', type: 'passif' },
      '425':  { nom: 'Personnel, dépôts', type: 'passif' },
      '428':  { nom: 'Personnel, charges à payer', type: 'passif' },
      '43':   { nom: 'Organismes sociaux', type: 'mixte' },
      '431':  { nom: 'CNSS — cotisations sociales', type: 'passif' },
      '432':  { nom: 'Mutuelles', type: 'passif' },
      '438':  { nom: 'Charges sociales, provisions', type: 'passif' },
      '44':   { nom: 'État et collectivités publiques', type: 'mixte' },
      '441':  { nom: 'État, impôts sur bénéfices', type: 'passif' },
      '442':  { nom: 'État, autres impôts et taxes', type: 'passif' },
      '4441': { nom: 'TVA facturée', type: 'passif' },
      '4442': { nom: 'TVA due intracommunautaire', type: 'passif' },
      '4445': { nom: 'TVA récupérable sur immobilisations', type: 'actif' },
      '4446': { nom: 'TVA récupérable sur achats', type: 'actif' },
      '4447': { nom: 'Crédit de TVA', type: 'actif' },
      '4449': { nom: 'TVA à régulariser', type: 'mixte' },
      '445':  { nom: 'État, subventions à recevoir', type: 'actif' },
      '446':  { nom: 'État, collectivités locales — impôts divers', type: 'passif' },
      '447':  { nom: 'État, impôts retenus à la source', type: 'passif' },
      '448':  { nom: 'État, charges à payer', type: 'passif' },
      '45':   { nom: 'Organismes internationaux', type: 'mixte' },
      '46':   { nom: 'Associés et groupe', type: 'mixte' },
      '461':  { nom: 'Associés, opérations sur le capital', type: 'passif' },
      '462':  { nom: 'Associés, dividendes à payer', type: 'passif' },
      '463':  { nom: 'Associés, versements reçus sur augmentation de capital', type: 'passif' },
      '464':  { nom: 'Associés, dividendes à recevoir', type: 'actif' },
      '47':   { nom: 'Débiteurs et créditeurs divers', type: 'mixte' },
      '471':  { nom: 'Débiteurs divers', type: 'actif' },
      '472':  { nom: 'Créditeurs divers', type: 'passif' },
      '476':  { nom: 'Charges constatées d\'avance', type: 'actif' },
      '477':  { nom: 'Produits constatés d\'avance', type: 'passif' },
      '478':  { nom: 'Autres charges à payer', type: 'passif' },
      '48':   { nom: 'Créances et dettes hors activités ordinaires', type: 'mixte' },
      '481':  { nom: 'Fournisseurs d\'investissements', type: 'passif' },
      '485':  { nom: 'Créances sur cessions d\'immobilisations', type: 'actif' },
      '49':   { nom: 'Dépréciations et provisions pour risques à court terme', type: 'passif' },
      '491':  { nom: 'Dépréciations des comptes clients', type: 'passif' },
      '499':  { nom: 'Provisions pour risques à court terme', type: 'passif' },
    },
  },

  classe5: {
    nom: 'Trésorerie',
    comptes: {
      '50':   { nom: 'Titres de placement', type: 'actif' },
      '501':  { nom: 'Titres et valeurs de placement', type: 'actif' },
      '502':  { nom: 'Actions propres ou parts propres', type: 'actif' },
      '51':   { nom: 'Valeurs à encaisser', type: 'actif' },
      '511':  { nom: 'Effets à encaisser', type: 'actif' },
      '512':  { nom: 'Chèques à encaisser', type: 'actif' },
      '514':  { nom: 'Virements de fonds', type: 'actif' },
      '52':   { nom: 'Banques', type: 'actif' },
      '521':  { nom: 'Banques locales — monnaie nationale', type: 'actif' },
      '522':  { nom: 'Banques locales — monnaie étrangère', type: 'actif' },
      '531':  { nom: 'Chèques postaux', type: 'actif' },
      '532':  { nom: 'Banque Centrale', type: 'actif' },
      '54':   { nom: 'Instruments de monnaie électronique', type: 'actif' },
      '541':  { nom: 'Airtel Money', type: 'actif' },
      '542':  { nom: 'MTN MoMo', type: 'actif' },
      '543':  { nom: 'Orange Money', type: 'actif' },
      '548':  { nom: 'Autres monnaies électroniques', type: 'actif' },
      '57':   { nom: 'Caisse', type: 'actif' },
      '571':  { nom: 'Caisse siège social', type: 'actif' },
      '572':  { nom: 'Caisses succursales ou établissements', type: 'actif' },
      '58':   { nom: 'Régies d\'avances, accréditifs et virements internes', type: 'actif' },
      '59':   { nom: 'Dépréciations et provisions pour risques', type: 'passif' },
    },
  },

  classe6: {
    nom: 'Charges des activités ordinaires',
    comptes: {
      '60':   { nom: 'Achats et variations de stocks', type: 'charge' },
      '601':  { nom: 'Achats de marchandises', type: 'charge' },
      '602':  { nom: 'Achats de matières premières', type: 'charge' },
      '604':  { nom: 'Achats de matières et fournitures consommables', type: 'charge' },
      '605':  { nom: 'Autres achats', type: 'charge' },
      '608':  { nom: 'Achats d\'emballages', type: 'charge' },
      '61':   { nom: 'Transports', type: 'charge' },
      '611':  { nom: 'Transports sur achats', type: 'charge' },
      '612':  { nom: 'Transports sur ventes', type: 'charge' },
      '614':  { nom: 'Transports pour le compte de tiers', type: 'charge' },
      '618':  { nom: 'Autres frais de transport', type: 'charge' },
      '62':   { nom: 'Services extérieurs A', type: 'charge' },
      '621':  { nom: 'Sous-traitance générale', type: 'charge' },
      '622':  { nom: 'Locations et charges locatives', type: 'charge' },
      '623':  { nom: 'Redevances de crédit-bail', type: 'charge' },
      '624':  { nom: 'Entretien, réparations et maintenance', type: 'charge' },
      '625':  { nom: 'Primes d\'assurance', type: 'charge' },
      '626':  { nom: 'Études et recherches', type: 'charge' },
      '627':  { nom: 'Publicité, publications, relations publiques', type: 'charge' },
      '628':  { nom: 'Frais de télécommunications', type: 'charge' },
      '63':   { nom: 'Services extérieurs B', type: 'charge' },
      '631':  { nom: 'Frais bancaires', type: 'charge' },
      '632':  { nom: 'Rémunérations d\'intermédiaires', type: 'charge' },
      '633':  { nom: 'Frais de formation du personnel', type: 'charge' },
      '634':  { nom: 'Redevances pour brevets, licences', type: 'charge' },
      '635':  { nom: 'Cotisations professionnelles', type: 'charge' },
      '637':  { nom: 'Frais de représentation', type: 'charge' },
      '638':  { nom: 'Divers services extérieurs', type: 'charge' },
      '64':   { nom: 'Impôts et taxes', type: 'charge' },
      '641':  { nom: 'Impôts et taxes directs', type: 'charge' },
      '642':  { nom: 'Contribution des patentes', type: 'charge' },
      '643':  { nom: 'Taxes sur salaires (TUS)', type: 'charge' },
      '644':  { nom: 'Droits d\'enregistrement', type: 'charge' },
      '645':  { nom: 'Taxes sur véhicules', type: 'charge' },
      '648':  { nom: 'Autres impôts et taxes', type: 'charge' },
      '65':   { nom: 'Autres charges', type: 'charge' },
      '651':  { nom: 'Pertes sur créances irrécouvrables', type: 'charge' },
      '658':  { nom: 'Charges diverses', type: 'charge' },
      '66':   { nom: 'Charges de personnel', type: 'charge' },
      '661':  { nom: 'Rémunérations directes versées au personnel', type: 'charge' },
      '662':  { nom: 'Rémunérations versées au personnel extérieur', type: 'charge' },
      '663':  { nom: 'Indemnités forfaitaires versées au personnel', type: 'charge' },
      '664':  { nom: 'Charges sociales — CNSS patronal', type: 'charge' },
      '665':  { nom: 'Charges de retraite', type: 'charge' },
      '668':  { nom: 'Autres charges sociales', type: 'charge' },
      '67':   { nom: 'Frais financiers et charges assimilées', type: 'charge' },
      '671':  { nom: 'Intérêts des emprunts', type: 'charge' },
      '672':  { nom: 'Intérêts des dettes de crédit-bail', type: 'charge' },
      '673':  { nom: 'Escomptes accordés', type: 'charge' },
      '674':  { nom: 'Pertes sur créances liées à des participations', type: 'charge' },
      '676':  { nom: 'Pertes de change', type: 'charge' },
      '677':  { nom: 'Charges nettes sur cessions de valeurs mobilières', type: 'charge' },
      '678':  { nom: 'Autres charges financières', type: 'charge' },
      '68':   { nom: 'Dotations aux amortissements et aux provisions', type: 'charge' },
      '681':  { nom: 'Dotations aux amortissements — charges immobilisées', type: 'charge' },
      '682':  { nom: 'Dotations aux amortissements — immobilisations incorporelles', type: 'charge' },
      '683':  { nom: 'Dotations aux amortissements — immobilisations corporelles', type: 'charge' },
      '686':  { nom: 'Dotations aux provisions — actif circulant', type: 'charge' },
      '687':  { nom: 'Dotations aux provisions — risques et charges', type: 'charge' },
      '69':   { nom: 'Impôts sur le résultat', type: 'charge' },
      '691':  { nom: 'Participation des travailleurs', type: 'charge' },
      '695':  { nom: 'Impôts sur les bénéfices', type: 'charge' },
    },
  },

  classe7: {
    nom: 'Produits des activités ordinaires',
    comptes: {
      '70':   { nom: 'Ventes', type: 'produit' },
      '701':  { nom: 'Ventes de marchandises', type: 'produit' },
      '702':  { nom: 'Ventes de produits finis', type: 'produit' },
      '703':  { nom: 'Ventes de produits intermédiaires', type: 'produit' },
      '704':  { nom: 'Ventes de travaux', type: 'produit' },
      '705':  { nom: 'Ventes de services', type: 'produit' },
      '706':  { nom: 'Produits des activités annexes', type: 'produit' },
      '707':  { nom: 'Produits des activités accessoires', type: 'produit' },
      '708':  { nom: 'Revenus des immeubles non affectés', type: 'produit' },
      '71':   { nom: 'Subventions d\'exploitation', type: 'produit' },
      '711':  { nom: 'Subventions d\'exploitation', type: 'produit' },
      '72':   { nom: 'Production immobilisée', type: 'produit' },
      '721':  { nom: 'Immobilisations incorporelles produites', type: 'produit' },
      '722':  { nom: 'Immobilisations corporelles produites', type: 'produit' },
      '73':   { nom: 'Variations de stocks de biens et services produits', type: 'produit' },
      '731':  { nom: 'Variations de stocks de produits finis', type: 'produit' },
      '74':   { nom: 'Produits d\'activités accessoires', type: 'produit' },
      '75':   { nom: 'Autres produits', type: 'produit' },
      '751':  { nom: 'Profits sur créances', type: 'produit' },
      '758':  { nom: 'Produits divers', type: 'produit' },
      '77':   { nom: 'Revenus financiers et produits assimilés', type: 'produit' },
      '771':  { nom: 'Intérêts de prêts', type: 'produit' },
      '772':  { nom: 'Produits sur cessions de valeurs mobilières', type: 'produit' },
      '773':  { nom: 'Escomptes obtenus', type: 'produit' },
      '776':  { nom: 'Gains de change', type: 'produit' },
      '778':  { nom: 'Autres produits financiers', type: 'produit' },
      '78':   { nom: 'Reprises de provisions et amortissements', type: 'produit' },
      '781':  { nom: 'Reprises d\'amortissements', type: 'produit' },
      '786':  { nom: 'Reprises de provisions — actif circulant', type: 'produit' },
      '787':  { nom: 'Reprises de provisions — risques et charges', type: 'produit' },
      '79':   { nom: 'Reprises de provisions', type: 'produit' },
      '791':  { nom: 'Reprises de provisions réglementées', type: 'produit' },
      '798':  { nom: 'Autres reprises', type: 'produit' },
    },
  },

  classe8: {
    nom: 'Autres charges et produits hors activités ordinaires',
    comptes: {
      '81':   { nom: 'Valeurs comptables des cessions d\'immobilisations', type: 'charge_hao' },
      '82':   { nom: 'Produits des cessions d\'immobilisations', type: 'produit_hao' },
      '83':   { nom: 'Charges hors activités ordinaires', type: 'charge_hao' },
      '84':   { nom: 'Produits hors activités ordinaires', type: 'produit_hao' },
      '85':   { nom: 'Dotations hors activités ordinaires', type: 'charge_hao' },
      '86':   { nom: 'Reprises hors activités ordinaires', type: 'produit_hao' },
      '87':   { nom: 'Participation des travailleurs', type: 'charge_hao' },
      '88':   { nom: 'Subventions d\'équilibre', type: 'produit_hao' },
      '89':   { nom: 'Impôts sur résultat hors activités ordinaires', type: 'charge_hao' },
    },
  },

  classe9: {
    nom: 'Comptabilité analytique',
    comptes: {
      '91':   { nom: 'Comptes d\'approvisionnement', type: 'analytique' },
      '92':   { nom: 'Comptes de production', type: 'analytique' },
      '93':   { nom: 'Comptes de distribution', type: 'analytique' },
      '94':   { nom: 'Comptes d\'administration générale', type: 'analytique' },
      '95':   { nom: 'Comptes de coûts de revient', type: 'analytique' },
      '96':   { nom: 'Comptes de différence d\'incorporation', type: 'analytique' },
      '97':   { nom: 'Résultats analytiques', type: 'analytique' },
      '98':   { nom: 'Compte de liaison avec la comptabilité financière', type: 'analytique' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste plate de tous les comptes (pour autocomplete)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompteFlat {
  numero:  string
  nom:     string
  type:    TypeCompte
  classe:  number
  classeNom: string
  soldeNormal: 'debit' | 'credit'
}

export const COMPTES_PLATS: CompteFlat[] = (() => {
  const result: CompteFlat[] = []
  let classeIdx = 1
  for (const data of Object.values(PLAN_COMPTABLE_SYSCOHADA)) {
    for (const [numero, compte] of Object.entries(data.comptes)) {
      result.push({
        numero,
        nom:          compte.nom,
        type:         compte.type,
        classe:       classeIdx,
        classeNom:    data.nom,
        soldeNormal:  getSoldeNormalForType(compte.type, numero),
      })
    }
    classeIdx++
  }
  return result.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
})()

function getSoldeNormalForType(type: TypeCompte, numero: string): 'debit' | 'credit' {
  const classe = parseInt(numero[0])
  if (type === 'actif') return 'debit'
  if (type === 'passif') return 'credit'
  if (type === 'charge' || type === 'charge_hao') return 'debit'
  if (type === 'produit' || type === 'produit_hao') return 'credit'
  if (classe === 6 || classe === 8) return 'debit'
  if (classe === 7) return 'credit'
  if ([1, 2, 5].includes(classe)) return 'credit'
  return 'debit'
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions utilitaires
// ─────────────────────────────────────────────────────────────────────────────

export function rechercherCompte(terme: string): CompteFlat[] {
  if (!terme || terme.trim().length < 2) return []
  const q = terme.toLowerCase().trim()
  return COMPTES_PLATS.filter(c =>
    c.numero.startsWith(q) ||
    c.nom.toLowerCase().includes(q)
  ).slice(0, 12)
}

export function getCompte(numero: string): CompteFlat | undefined {
  return COMPTES_PLATS.find(c => c.numero === numero)
}

export function getSoldeNormal(numero: string): 'debit' | 'credit' {
  return getCompte(numero)?.soldeNormal ?? 'debit'
}

export const TYPE_COLORS: Record<TypeCompte, { color: string; bg: string; label: string }> = {
  actif:        { color: '#2563EB', bg: '#EFF6FF', label: 'Actif' },
  passif:       { color: '#16A34A', bg: '#F0FDF4', label: 'Passif' },
  mixte:        { color: '#64748B', bg: '#F8FAFC', label: 'Mixte' },
  charge:       { color: '#DC2626', bg: '#FEF2F2', label: 'Charge' },
  produit:      { color: '#0891B2', bg: '#F0F9FF', label: 'Produit' },
  charge_hao:   { color: '#EA580C', bg: '#FFF7ED', label: 'Charge HAO' },
  produit_hao:  { color: '#7C3AED', bg: '#F5F3FF', label: 'Produit HAO' },
  analytique:   { color: '#94A3B8', bg: '#F8FAFC', label: 'Analytique' },
}

export const CLASSES_NOMS: Record<number, string> = {
  1: 'Classe 1 — Ressources durables',
  2: 'Classe 2 — Actif immobilisé',
  3: 'Classe 3 — Stocks',
  4: 'Classe 4 — Tiers',
  5: 'Classe 5 — Trésorerie',
  6: 'Classe 6 — Charges des activités ordinaires',
  7: 'Classe 7 — Produits des activités ordinaires',
  8: 'Classe 8 — Charges et produits HAO',
  9: 'Classe 9 — Comptabilité analytique',
}
