import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import ExcelJS from 'exceljs'

// ── Design tokens ─────────────────────────────────────────────────────────────

const ROUGE   = 'FFDC2626'
const ROUGE_L = 'FFFEE2E2'
const NOIR    = 'FF0F172A'
const GRIS    = 'FF64748B'
const GRIS_L  = 'FFF8FAFC'
const VERT    = 'FF16A34A'
const VERT_L  = 'FFDCFCE7'
const AMBER   = 'FFF59E0B'
const BLEU    = 'FF2563EB'
const WHITE   = 'FFFFFFFF'

function styleHeader(cell: ExcelJS.Cell, bgColor: string = NOIR, textColor: string = WHITE) {
  cell.font = { bold: true, color: { argb: textColor }, size: 10, name: 'Arial' }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  }
}

function styleRow(row: ExcelJS.Row, isOdd: boolean) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOdd ? WHITE : GRIS_L } }
    cell.font = { size: 9, name: 'Arial' }
    cell.alignment = { vertical: 'middle' }
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    }
  })
}

function addSheetTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, colCount: number, color: string) {
  ws.mergeCells(1, 1, 1, colCount)
  const titleCell = ws.getCell('A1')
  titleCell.value = title
  titleCell.font = { bold: true, size: 16, name: 'Arial', color: { argb: WHITE } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 36

  ws.mergeCells(2, 1, 2, colCount)
  const subCell = ws.getCell('A2')
  subCell.value = subtitle
  subCell.font = { size: 9, name: 'Arial', color: { argb: GRIS } }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_L } }
  subCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 18
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const tenantId = callerProfile.tenant_id
  const now      = new Date()
  const year     = req.nextUrl.searchParams.get('annee') ?? now.getFullYear().toString()
  const dateLabel = `Année ${year}`

  const [factures, bulletins, transactions, stocks, config, tenant] = await Promise.all([
    supabaseAdmin.from('factures').select('invoice_number,client_name,client_nom,date,statut,subtotal,tva,ca,total,type')
      .eq('tenant_id', tenantId).order('date', { ascending: false }).limit(500),
    supabaseAdmin.from('bulletins_paie').select('mois,annee,employes(nom,poste),salaire_base,brut,cnss_salarie,irpp,net,statut')
      .eq('tenant_id', tenantId).order('annee', { ascending: false }).order('mois', { ascending: false }).limit(500),
    supabaseAdmin.from('transactions').select('date,type,categorie,description,montant,mode_paiement')
      .eq('tenant_id', tenantId).order('date', { ascending: false }).limit(500),
    supabaseAdmin.from('articles').select('nom,code,categorie,prix_vente,quantite_stock,seuil_alerte,valeur_stock')
      .eq('tenant_id', tenantId).order('nom').limit(500),
    supabaseAdmin.from('entreprise_config').select('nom,adresse,telephone').eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
  ])

  const nomEntreprise = config.data?.nom ?? tenant.data?.nom_entreprise ?? 'Entreprise'
  const wb = new ExcelJS.Workbook()
  wb.creator = 'oraforme'
  wb.created = now

  // ── ONGLET 1: TABLEAU DE BORD ─────────────────────────────────────────────

  const wsDash = wb.addWorksheet('Tableau de bord')
  wsDash.properties.tabColor = { argb: ROUGE }
  wsDash.columns = [
    { width: 32 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ]
  addSheetTitle(wsDash, `${nomEntreprise} — Tableau de Bord`, `${dateLabel} · Généré le ${fmtDate(now.toISOString())}`, 5, ROUGE)

  wsDash.getRow(4).values = ['Indicateur', 'Valeur', '', '', '']
  styleHeader(wsDash.getCell('A4'), ROUGE, WHITE)
  styleHeader(wsDash.getCell('B4'), ROUGE, WHITE)
  wsDash.getRow(4).height = 22

  const facsData = factures.data ?? []
  const transData = transactions.data ?? []
  const bulData = bulletins.data ?? []

  const totalFactures = facsData.length
  const totalEncaisse = facsData.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalEnAttente = facsData.filter(f => f.statut !== 'payee' && f.statut !== 'annulee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalEntrees = transData.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
  const totalSorties = transData.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)
  const masseSalariale = bulData.reduce((s, b) => s + (b.net ?? 0), 0)

  const kpiRows = [
    ['Nombre de factures', totalFactures],
    ['Chiffre d\'affaires encaissé (FCFA)', totalEncaisse],
    ['Factures en attente (FCFA)', totalEnAttente],
    ['Total entrées trésorerie (FCFA)', totalEntrees],
    ['Total sorties trésorerie (FCFA)', totalSorties],
    ['Solde trésorerie (FCFA)', totalEntrees - totalSorties],
    ['Masse salariale nette (FCFA)', masseSalariale],
    ['Nombre de bulletins de paie', bulData.length],
    ['Nombre d\'articles en stock', (stocks.data ?? []).length],
  ]

  kpiRows.forEach((row, i) => {
    const r = wsDash.getRow(5 + i)
    r.values = row
    r.getCell(1).font = { size: 9, name: 'Arial', color: { argb: NOIR } }
    r.getCell(2).font = { size: 10, name: 'Arial', bold: true, color: { argb: ROUGE } }
    r.getCell(2).numFmt = '#,##0'
    r.height = 18
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRIS_L } }
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRIS_L } }
  })

  // ── ONGLET 2: FACTURES ────────────────────────────────────────────────────

  const wsFac = wb.addWorksheet('Factures')
  wsFac.properties.tabColor = { argb: BLEU }
  wsFac.columns = [
    { key: 'num',     width: 18 },
    { key: 'client',  width: 28 },
    { key: 'date',    width: 14 },
    { key: 'type',    width: 12 },
    { key: 'ht',      width: 16 },
    { key: 'tva',     width: 14 },
    { key: 'ca',      width: 12 },
    { key: 'ttc',     width: 16 },
    { key: 'statut',  width: 14 },
  ]
  addSheetTitle(wsFac, 'Factures', `${totalFactures} facture(s)`, 9, BLEU)

  const facHeaders = ['N° Facture', 'Client', 'Date', 'Type', 'HT (FCFA)', 'TVA 18% (FCFA)', 'CA 5% (FCFA)', 'TTC (FCFA)', 'Statut']
  const facHeaderRow = wsFac.getRow(4)
  facHeaderRow.values = facHeaders
  facHeaders.forEach((_, ci) => styleHeader(wsFac.getCell(4, ci + 1), BLEU, WHITE))
  facHeaderRow.height = 22

  facsData.forEach((f, i) => {
    const r = wsFac.getRow(5 + i)
    r.values = [
      f.invoice_number ?? '—',
      f.client_name ?? f.client_nom ?? '—',
      fmtDate(f.date),
      f.type ?? 'facture',
      f.subtotal ?? 0,
      f.tva ?? 0,
      f.ca ?? 0,
      f.total ?? 0,
      f.statut ?? '—',
    ]
    styleRow(r, i % 2 === 0)
    ;[5, 6, 7, 8].forEach(ci => {
      r.getCell(ci).numFmt = '#,##0'
      r.getCell(ci).font = { size: 9, name: 'Arial', bold: ci === 8 }
    })
    if (f.statut === 'payee') {
      r.getCell(9).font = { size: 9, name: 'Arial', color: { argb: VERT }, bold: true }
    } else if (f.statut === 'retard') {
      r.getCell(9).font = { size: 9, name: 'Arial', color: { argb: ROUGE }, bold: true }
    }
  })

  // Total row
  if (facsData.length > 0) {
    const totRow = wsFac.getRow(5 + facsData.length + 1)
    totRow.values = ['TOTAL', '', '', '', `=SUM(E5:E${4 + facsData.length})`, `=SUM(F5:F${4 + facsData.length})`, `=SUM(G5:G${4 + facsData.length})`, `=SUM(H5:H${4 + facsData.length})`, '']
    totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: WHITE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOIR } }
      if ([5, 6, 7, 8].includes(ci)) cell.numFmt = '#,##0'
    })
    totRow.height = 22
  }

  // ── ONGLET 3: PAIE ────────────────────────────────────────────────────────

  const wsPaye = wb.addWorksheet('Paie')
  wsPaye.properties.tabColor = { argb: VERT }
  wsPaye.columns = [
    { key: 'employe',  width: 28 },
    { key: 'poste',    width: 22 },
    { key: 'mois',     width: 10 },
    { key: 'annee',    width: 10 },
    { key: 'base',     width: 16 },
    { key: 'brut',     width: 16 },
    { key: 'cnss',     width: 14 },
    { key: 'irpp',     width: 14 },
    { key: 'net',      width: 16 },
    { key: 'statut',   width: 14 },
  ]
  addSheetTitle(wsPaye, 'Bulletins de Paie', `${bulData.length} bulletin(s)`, 10, VERT)

  const payeHeaders = ['Employé', 'Poste', 'Mois', 'Année', 'Base (FCFA)', 'Brut (FCFA)', 'CNSS Salarié', 'IRPP', 'Net à payer (FCFA)', 'Statut']
  const payeHeaderRow = wsPaye.getRow(4)
  payeHeaderRow.values = payeHeaders
  payeHeaders.forEach((_, ci) => styleHeader(wsPaye.getCell(4, ci + 1), VERT, WHITE))
  payeHeaderRow.height = 22

  const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  bulData.forEach((b, i) => {
    const emp = b.employes as { nom?: string; poste?: string } | null
    const r = wsPaye.getRow(5 + i)
    r.values = [
      emp?.nom ?? '—',
      emp?.poste ?? '—',
      MOIS[b.mois ?? 1] ?? '—',
      b.annee ?? '—',
      b.salaire_base ?? 0,
      b.brut ?? 0,
      b.cnss_salarie ?? 0,
      b.irpp ?? 0,
      b.net ?? 0,
      b.statut ?? '—',
    ]
    styleRow(r, i % 2 === 0)
    ;[5, 6, 7, 8, 9].forEach(ci => {
      r.getCell(ci).numFmt = '#,##0'
    })
  })

  if (bulData.length > 0) {
    const totRow = wsPaye.getRow(5 + bulData.length + 1)
    totRow.values = ['TOTAL', '', '', '', `=SUM(E5:E${4 + bulData.length})`, `=SUM(F5:F${4 + bulData.length})`, `=SUM(G5:G${4 + bulData.length})`, `=SUM(H5:H${4 + bulData.length})`, `=SUM(I5:I${4 + bulData.length})`, '']
    totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: WHITE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOIR } }
      if ([5, 6, 7, 8, 9].includes(ci)) cell.numFmt = '#,##0'
    })
    totRow.height = 22
  }

  // ── ONGLET 4: TRÉSORERIE ──────────────────────────────────────────────────

  const wsTreso = wb.addWorksheet('Trésorerie')
  wsTreso.properties.tabColor = { argb: AMBER }
  wsTreso.columns = [
    { key: 'date',   width: 14 },
    { key: 'type',   width: 12 },
    { key: 'cat',    width: 20 },
    { key: 'desc',   width: 36 },
    { key: 'entree', width: 18 },
    { key: 'sortie', width: 18 },
    { key: 'mode',   width: 16 },
  ]
  addSheetTitle(wsTreso, 'Trésorerie', `${transData.length} transaction(s) · Solde: ${(totalEntrees - totalSorties).toLocaleString('fr-FR')} FCFA`, 7, AMBER)

  const tresoHeaders = ['Date', 'Type', 'Catégorie', 'Description', 'Entrée (FCFA)', 'Sortie (FCFA)', 'Mode paiement']
  const tresoHeaderRow = wsTreso.getRow(4)
  tresoHeaderRow.values = tresoHeaders
  tresoHeaders.forEach((_, ci) => styleHeader(wsTreso.getCell(4, ci + 1), AMBER, NOIR))
  tresoHeaderRow.height = 22

  transData.forEach((t, i) => {
    const r = wsTreso.getRow(5 + i)
    r.values = [
      fmtDate(t.date),
      t.type === 'entree' ? 'Entrée' : 'Sortie',
      t.categorie ?? '—',
      t.description ?? '—',
      t.type === 'entree' ? (t.montant ?? 0) : 0,
      t.type === 'sortie' ? (t.montant ?? 0) : 0,
      t.mode_paiement ?? '—',
    ]
    styleRow(r, i % 2 === 0)
    r.getCell(5).numFmt = '#,##0'
    r.getCell(6).numFmt = '#,##0'
    if (t.type === 'entree') {
      r.getCell(5).font = { size: 9, name: 'Arial', bold: true, color: { argb: VERT } }
    } else {
      r.getCell(6).font = { size: 9, name: 'Arial', bold: true, color: { argb: ROUGE } }
    }
  })

  if (transData.length > 0) {
    const totRow = wsTreso.getRow(5 + transData.length + 1)
    totRow.values = ['TOTAL', '', '', '', `=SUM(E5:E${4 + transData.length})`, `=SUM(F5:F${4 + transData.length})`, '']
    totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: WHITE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOIR } }
      if (ci === 5) cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: VERT_L } }
      if (ci === 6) cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: ROUGE_L } }
      if ([5, 6].includes(ci)) cell.numFmt = '#,##0'
    })
    totRow.height = 22
  }

  // ── ONGLET 5: STOCK ───────────────────────────────────────────────────────

  const wsStock = wb.addWorksheet('Stock')
  wsStock.properties.tabColor = { argb: GRIS }
  const stockData = stocks.data ?? []
  wsStock.columns = [
    { key: 'nom',      width: 32 },
    { key: 'code',     width: 14 },
    { key: 'cat',      width: 20 },
    { key: 'prix',     width: 16 },
    { key: 'qte',      width: 12 },
    { key: 'alerte',   width: 12 },
    { key: 'valeur',   width: 18 },
    { key: 'statut',   width: 14 },
  ]
  addSheetTitle(wsStock, 'Stock', `${stockData.length} article(s)`, 8, GRIS)

  const stockHeaders = ['Désignation', 'Code', 'Catégorie', 'Prix vente (FCFA)', 'Qté stock', 'Seuil alerte', 'Valeur stock (FCFA)', 'Statut']
  const stockHeaderRow = wsStock.getRow(4)
  stockHeaderRow.values = stockHeaders
  stockHeaders.forEach((_, ci) => styleHeader(wsStock.getCell(4, ci + 1), GRIS, WHITE))
  stockHeaderRow.height = 22

  stockData.forEach((art, i) => {
    const qte = art.quantite_stock ?? 0
    const seuil = art.seuil_alerte ?? 0
    const enAlerte = seuil > 0 && qte <= seuil
    const r = wsStock.getRow(5 + i)
    r.values = [
      art.nom ?? '—',
      art.code ?? '—',
      art.categorie ?? '—',
      art.prix_vente ?? 0,
      qte,
      seuil || '—',
      art.valeur_stock ?? (art.prix_vente ?? 0) * qte,
      enAlerte ? 'ALERTE' : qte === 0 ? 'RUPTURE' : 'OK',
    ]
    styleRow(r, i % 2 === 0)
    ;[4, 5, 7].forEach(ci => { r.getCell(ci).numFmt = '#,##0' })
    const statusCell = r.getCell(8)
    if (qte === 0) {
      statusCell.font = { size: 9, name: 'Arial', bold: true, color: { argb: ROUGE } }
    } else if (enAlerte) {
      statusCell.font = { size: 9, name: 'Arial', bold: true, color: { argb: AMBER } }
    } else {
      statusCell.font = { size: 9, name: 'Arial', bold: true, color: { argb: VERT } }
    }
  })

  if (stockData.length > 0) {
    const totRow = wsStock.getRow(5 + stockData.length + 1)
    totRow.values = ['TOTAL', '', '', '', `=SUM(E5:E${4 + stockData.length})`, '', `=SUM(G5:G${4 + stockData.length})`, '']
    totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: WHITE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOIR } }
      if ([5, 7].includes(ci)) cell.numFmt = '#,##0'
    })
    totRow.height = 22
  }

  // ── Serialize + return ────────────────────────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `rapport-${nomEntreprise.replace(/\s+/g, '-')}-${year}.xlsx`

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
