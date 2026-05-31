import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const file  = resolve(__dir, '..', 'lib', 'i18n.ts')
let content = readFileSync(file, 'utf8')

// anchor → exact string in file (unique per language); keys inserted AFTER it
const blocks = [
  {
    lang: 'fr',
    anchor: `    'dashboard.activite':          'Activité récente',`,
    keys: `
    // ── SIDEBAR SOUS-TITRES & PLACEHOLDERS ───────────────────────
    'sidebar.compta.sub':       'Journal OHADA',
    'sidebar.rh.sub':           'Personnel & salaires',
    'sidebar.stock.sub':        'Gestion des stocks',
    'sidebar.resto.sub':        'Commandes & tables',
    'sidebar.ecole.sub':        'Scolarité & paiements',
    'sidebar.tresorerie.sub':   'Flux & trésorerie',
    'sidebar.facturation.sub':  'Devis & factures',
    'sidebar.achats.sub':       'Fournisseurs & achats',
    'sidebar.depenses.sub':     'Notes de frais',
    'sidebar.crm.sub':          'Clients & prospects',
    'sidebar.documents.sub':    'Fichiers & archives',
    'sidebar.rapports.sub':     'Rapports & exports',
    'placeholder.rechercher':   'Rechercher...',
    'empty.factures':           'Aucune facture pour le moment',
    'empty.employes':           'Aucun employé ajouté',
    'empty.articles':           'Aucun article en stock',
    'empty.commandes':          'Aucune commande enregistrée',
    'empty.etudiants':          'Aucun étudiant inscrit',`
  },
  {
    lang: 'en',
    anchor: `    'dashboard.activite':          'Recent activity',`,
    keys: `
    'sidebar.compta.sub':       'OHADA Journal',
    'sidebar.rh.sub':           'Staff & payroll',
    'sidebar.stock.sub':        'Inventory management',
    'sidebar.resto.sub':        'Orders & tables',
    'sidebar.ecole.sub':        'Enrollment & payments',
    'sidebar.tresorerie.sub':   'Cash flow',
    'sidebar.facturation.sub':  'Quotes & invoices',
    'sidebar.achats.sub':       'Suppliers & purchases',
    'sidebar.depenses.sub':     'Expense reports',
    'sidebar.crm.sub':          'Customers & leads',
    'sidebar.documents.sub':    'Files & archives',
    'sidebar.rapports.sub':     'Reports & exports',
    'placeholder.rechercher':   'Search...',
    'empty.factures':           'No invoices yet',
    'empty.employes':           'No employees added',
    'empty.articles':           'No items in stock',
    'empty.commandes':          'No orders recorded',
    'empty.etudiants':          'No students enrolled',`
  },
  {
    lang: 'pt',
    anchor: `'dashboard.activite': 'Atividade recente',`,
    keys: `
    'sidebar.compta.sub':       'Diário OHADA',
    'sidebar.rh.sub':           'Pessoal & salários',
    'sidebar.stock.sub':        'Gestão de stocks',
    'sidebar.resto.sub':        'Pedidos & mesas',
    'sidebar.ecole.sub':        'Matrículas & pagamentos',
    'sidebar.tresorerie.sub':   'Fluxo de caixa',
    'sidebar.facturation.sub':  'Orçamentos & faturas',
    'sidebar.achats.sub':       'Fornecedores & compras',
    'sidebar.depenses.sub':     'Notas de despesas',
    'sidebar.crm.sub':          'Clientes & leads',
    'sidebar.documents.sub':    'Ficheiros & arquivos',
    'sidebar.rapports.sub':     'Relatórios & exportações',
    'placeholder.rechercher':   'Pesquisar...',
    'empty.factures':           'Nenhuma fatura por enquanto',
    'empty.employes':           'Nenhum funcionário adicionado',
    'empty.articles':           'Nenhum artigo em stock',
    'empty.commandes':          'Nenhuma encomenda registada',
    'empty.etudiants':          'Nenhum estudante inscrito',`
  },
  {
    lang: 'es',
    anchor: `'dashboard.activite': 'Actividad reciente',`,
    keys: `
    'sidebar.compta.sub':       'Diario OHADA',
    'sidebar.rh.sub':           'Personal & nóminas',
    'sidebar.stock.sub':        'Gestión de inventario',
    'sidebar.resto.sub':        'Pedidos & mesas',
    'sidebar.ecole.sub':        'Matrículas & pagos',
    'sidebar.tresorerie.sub':   'Flujo de caja',
    'sidebar.facturation.sub':  'Presupuestos & facturas',
    'sidebar.achats.sub':       'Proveedores & compras',
    'sidebar.depenses.sub':     'Notas de gastos',
    'sidebar.crm.sub':          'Clientes & prospectos',
    'sidebar.documents.sub':    'Archivos & documentos',
    'sidebar.rapports.sub':     'Informes & exportaciones',
    'placeholder.rechercher':   'Buscar...',
    'empty.factures':           'Sin facturas por ahora',
    'empty.employes':           'Sin empleados agregados',
    'empty.articles':           'Sin artículos en stock',
    'empty.commandes':          'Sin pedidos registrados',
    'empty.etudiants':          'Sin estudiantes inscritos',`
  },
  {
    lang: 'ln',
    anchor: `'dashboard.activite': 'Misala ya sika',`,
    keys: `
    'sidebar.compta.sub':       'Livre ya Mbongo',
    'sidebar.rh.sub':           'Basali & Lifuta',
    'sidebar.stock.sub':        'Biloko ya Boutique',
    'sidebar.resto.sub':        'Biloko ya Kolia',
    'sidebar.ecole.sub':        'Koteya & Mitindo',
    'sidebar.tresorerie.sub':   'Mbongo ya Caisse',
    'sidebar.facturation.sub':  'Facture & Devis',
    'sidebar.achats.sub':       'Kobola Biloko',
    'sidebar.depenses.sub':     'Mbongo ya Kotia',
    'sidebar.crm.sub':          'Bakliyenti',
    'sidebar.documents.sub':    'Mapapier & Fichier',
    'sidebar.rapports.sub':     'Rapport ya Mosala',
    'placeholder.rechercher':   'Koluka...',
    'empty.factures':           'Facture te',
    'empty.employes':           'Mosali te',
    'empty.articles':           'Biloko te',
    'empty.commandes':          'Commande te',
    'empty.etudiants':          'Moteyi te',`
  },
  {
    lang: 'sw',
    anchor: `'dashboard.activite': 'Shughuli za hivi karibuni',`,
    keys: `
    'sidebar.compta.sub':       'Daftari la OHADA',
    'sidebar.rh.sub':           'Wafanyakazi & mishahara',
    'sidebar.stock.sub':        'Usimamizi wa ghala',
    'sidebar.resto.sub':        'Maagizo & meza',
    'sidebar.ecole.sub':        'Usajili & malipo',
    'sidebar.tresorerie.sub':   'Mtiririko wa fedha',
    'sidebar.facturation.sub':  'Makadirio & bili',
    'sidebar.achats.sub':       'Wasambazaji & manunuzi',
    'sidebar.depenses.sub':     'Ripoti ya gharama',
    'sidebar.crm.sub':          'Wateja & wataalamu',
    'sidebar.documents.sub':    'Faili & hifadhi',
    'sidebar.rapports.sub':     'Ripoti & usafirishaji',
    'placeholder.rechercher':   'Tafuta...',
    'empty.factures':           'Hakuna bili bado',
    'empty.employes':           'Hakuna wafanyakazi',
    'empty.articles':           'Hakuna bidhaa ghalani',
    'empty.commandes':          'Hakuna agizo lililorekodiwa',
    'empty.etudiants':          'Hakuna mwanafunzi aliyesajiliwa',`
  },
  {
    lang: 'de',
    anchor: `'dashboard.activite': 'Letzte Aktivität',`,
    keys: `
    'sidebar.compta.sub':       'OHADA-Journal',
    'sidebar.rh.sub':           'Personal & Gehälter',
    'sidebar.stock.sub':        'Lagerverwaltung',
    'sidebar.resto.sub':        'Bestellungen & Tische',
    'sidebar.ecole.sub':        'Anmeldungen & Zahlungen',
    'sidebar.tresorerie.sub':   'Cashflow',
    'sidebar.facturation.sub':  'Angebote & Rechnungen',
    'sidebar.achats.sub':       'Lieferanten & Einkäufe',
    'sidebar.depenses.sub':     'Spesenberichte',
    'sidebar.crm.sub':          'Kunden & Interessenten',
    'sidebar.documents.sub':    'Dateien & Archive',
    'sidebar.rapports.sub':     'Berichte & Exporte',
    'placeholder.rechercher':   'Suchen...',
    'empty.factures':           'Noch keine Rechnungen',
    'empty.employes':           'Keine Mitarbeiter hinzugefügt',
    'empty.articles':           'Keine Artikel im Lager',
    'empty.commandes':          'Keine Bestellungen erfasst',
    'empty.etudiants':          'Keine Studenten eingeschrieben',`
  },
  {
    lang: 'kg',
    // KG has no dashboard.activite — insert before the final closing of the block
    anchor: `    'nav.boisson_tournees':  'Balabala ya Kotinda',\n  },\n}`,
    keys: `
    'sidebar.compta.sub':       'Livre ya Mbongo',
    'sidebar.rh.sub':           'Basali & Lifuta',
    'sidebar.stock.sub':        'Biloko ya Boutique',
    'sidebar.resto.sub':        'Biloko ya Kolia',
    'sidebar.ecole.sub':        'Koteya & Mitindo',
    'sidebar.tresorerie.sub':   'Mbongo ya Caisse',
    'sidebar.facturation.sub':  'Facture & Devis',
    'sidebar.achats.sub':       'Kobola Biloko',
    'sidebar.depenses.sub':     'Mbongo ya Kotia',
    'sidebar.crm.sub':          'Bakliyenti',
    'sidebar.documents.sub':    'Mapapier & Fichier',
    'sidebar.rapports.sub':     'Rapport ya Mosala',
    'placeholder.rechercher':   'Koluka...',
    'empty.factures':           'Facture te',
    'empty.employes':           'Mosali te',
    'empty.articles':           'Biloko te',
    'empty.commandes':          'Commande te',
    'empty.etudiants':          'Moteyi te',`,
    kgReplace: true,
  },
]

let modified = 0
for (const block of blocks) {
  const { lang, anchor, keys, kgReplace } = block
  if (!content.includes(anchor)) {
    console.log(`❌ ${lang}: anchor not found`)
    continue
  }
  if (kgReplace) {
    content = content.replace(
      `    'nav.boisson_tournees':  'Balabala ya Kotinda',\n  },\n}`,
      `    'nav.boisson_tournees':  'Balabala ya Kotinda',${keys}\n  },\n}`
    )
  } else {
    content = content.replace(anchor, `${anchor}${keys}`)
  }
  console.log(`✅ ${lang}: inserted`)
  modified++
}

writeFileSync(file, content, 'utf8')
console.log(`\nDone: ${modified}/8 blocks updated`)
