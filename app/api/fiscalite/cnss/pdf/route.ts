import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/fiscalite/cnss/pdf?mois=5&annee=2026
 * Génère une déclaration CNSS mensuelle en HTML imprimable (format DGI/CNSS Congo).
 * Retourne text/html — le frontend ouvre dans un onglet et déclenche l'impression.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = Number(searchParams.get('mois')  ?? new Date().getMonth() + 1)

  const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // 1. Bulletins du mois avec données employé
  const { data: bulletins, error } = await supabaseAdmin
    .from('bulletins_paie')
    .select(`
      id, mois, annee, brut, cnss_salarie, cnss_patronal, irpp, net, statut,
      employes (nom, poste, matricule, cnss, departement)
    `)
    .eq('tenant_id', ctx.tid)
    .eq('mois', mois)
    .eq('annee', annee)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. Config entreprise
  const { data: config } = await supabaseAdmin
    .from('entreprise_config')
    .select('nom, niu, rccm, adresse')
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  const nom     = config?.nom   ?? 'ENTREPRISE'
  const nif     = config?.niu   ?? '—'
  const rccm    = config?.rccm  ?? '—'
  const adresse = config?.adresse ?? '—'

  // 3. Totaux
  const items = (bulletins ?? []) as unknown as {
    brut: number; cnss_salarie: number; cnss_patronal: number; irpp: number;
    employes: { nom: string; poste: string; matricule: string; cnss: string; departement: string } | null
  }[]

  const totBrut    = items.reduce((s, b) => s + b.brut, 0)
  const totSal     = items.reduce((s, b) => s + b.cnss_salarie, 0)
  const totPat     = items.reduce((s, b) => s + b.cnss_patronal, 0)
  const totCnss    = totSal + totPat

  // Taux imprimés : dérivés des montants réellement liquidés, jamais saisis.
  // Le document annonçait « 5,04 % / 14,36 % », valeurs qui ne correspondaient
  // à aucun calcul du moteur fiscal.
  const pct = (montant: number) =>
    totBrut > 0 ? `${((montant / totBrut) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %` : '—'
  const tauxSalEffectif = pct(totSal)
  const tauxPatEffectif = pct(totPat)
  const totIrpp    = items.reduce((s, b) => s + b.irpp, 0)

  function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

  // 4. HTML déclaration
  const rows = items.map((b, i) => {
    const e = b.employes
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${e?.matricule ?? '—'}</td>
        <td>${e?.nom ?? '—'}</td>
        <td>${e?.cnss ?? '—'}</td>
        <td>${e?.poste ?? '—'}</td>
        <td class="num">${fmt(b.brut)}</td>
        <td class="num">${fmt(b.cnss_salarie)}</td>
        <td class="num">${fmt(b.cnss_patronal)}</td>
        <td class="num">${fmt(b.cnss_salarie + b.cnss_patronal)}</td>
        <td class="num">${fmt(b.irpp)}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Déclaration CNSS — ${MOIS_LABELS[mois]} ${annee}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Arial', sans-serif; }
    body { font-size: 9pt; color: #111; background: white; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .logo-block { display: flex; flex-direction: column; gap: 2px; }
    .logo-block .company { font-size: 14pt; font-weight: 900; color: #111; }
    .logo-block .sub { font-size: 8pt; color: #444; }

    .title-block { text-align: center; }
    .title-block h1 { font-size: 13pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #111; }
    .title-block .period { font-size: 10pt; color: #555; margin-top: 3px; }

    .stamp-block { text-align: right; font-size: 8pt; color: #555; border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; }
    .stamp-block .label { font-weight: bold; color: #111; font-size: 9pt; }

    .info-bar { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; margin-bottom: 14px; display: flex; gap: 32px; }
    .info-bar .item label { font-size: 7pt; color: #666; text-transform: uppercase; font-weight: bold; }
    .info-bar .item span  { font-size: 9pt; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; }
    th { background: #1e40af; color: white; font-size: 8pt; font-weight: bold; text-transform: uppercase; text-align: center; }
    td { font-size: 8pt; vertical-align: middle; }
    td.num { text-align: right; font-family: 'Courier New', monospace; }
    tr:nth-child(even) { background: #f9f9f9; }

    .totals { background: #1e40af; color: white; font-weight: bold; }
    .totals td { font-size: 9pt; }

    .summary { display: flex; gap: 12px; margin-bottom: 14px; }
    .sum-box { flex: 1; border: 2px solid #1e40af; border-radius: 6px; padding: 10px 14px; }
    .sum-box .label { font-size: 7pt; text-transform: uppercase; color: #555; font-weight: bold; margin-bottom: 3px; }
    .sum-box .value { font-size: 14pt; font-weight: 900; color: #1e40af; }
    .sum-box.danger .value { color: #dc2626; }
    .sum-box.danger { border-color: #dc2626; }

    .signatures { display: flex; gap: 40px; margin-top: 20px; }
    .sig-box { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-size: 8pt; color: #555; }
    .sig-box strong { display: block; margin-bottom: 3px; color: #111; }

    .footer { text-align: center; font-size: 7pt; color: #888; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 8px; }

    @media print {
      body { font-size: 8pt; }
      .no-print { display: none !important; }
    }

    .print-btn {
      position: fixed; top: 16px; right: 16px; z-index: 99;
      background: #1e40af; color: white; border: none; padding: 10px 20px;
      border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer / PDF</button>

<div class="header">
  <div class="logo-block">
    <span class="company">${nom}</span>
    <span class="sub">NIU: ${nif} · RCCM: ${rccm}</span>
    <span class="sub">${adresse}</span>
  </div>
  <div class="title-block">
    <h1>Déclaration CNSS Mensuelle</h1>
    <div class="period">Mois de ${MOIS_LABELS[mois]} ${annee}</div>
    <div style="font-size:8pt;color:#888;margin-top:4px">République du Congo · CNSS · Taux effectifs sur la masse : salarié ${tauxSalEffectif} · patronal ${tauxPatEffectif}</div>
  </div>
  <div class="stamp-block">
    <div class="label">Date d'édition</div>
    <div>${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    <div style="margin-top:4px">Réf: CNSS-${annee}-${String(mois).padStart(2, '0')}</div>
  </div>
</div>

<div class="info-bar">
  <div class="item"><label>Effectif déclaré</label><span>${items.length} salarié${items.length > 1 ? 's' : ''}</span></div>
  <div class="item"><label>Masse salariale brute</label><span>${fmt(totBrut)} FCFA</span></div>
  <div class="item"><label>CNSS salarié (${tauxSalEffectif} effectif)</label><span>${fmt(totSal)} FCFA</span></div>
  <div class="item"><label>CNSS patronal (${tauxPatEffectif} effectif)</label><span>${fmt(totPat)} FCFA</span></div>
  <div class="item"><label>Total CNSS à verser</label><span style="color:#dc2626;font-weight:900">${fmt(totCnss)} FCFA</span></div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Matricule</th>
      <th>Nom & Prénom</th>
      <th>N° CNSS</th>
      <th>Poste</th>
      <th>Salaire Brut</th>
      <th>CNSS Salarié</th>
      <th>CNSS Patronal</th>
      <th>Total CNSS</th>
      <th>IRPP retenu</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="totals">
      <td colspan="5" style="text-align:center">TOTAUX</td>
      <td class="num">${fmt(totBrut)} F</td>
      <td class="num">${fmt(totSal)} F</td>
      <td class="num">${fmt(totPat)} F</td>
      <td class="num">${fmt(totCnss)} F</td>
      <td class="num">${fmt(totIrpp)} F</td>
    </tr>
  </tbody>
</table>

<div class="summary">
  <div class="sum-box">
    <div class="label">Masse salariale brute</div>
    <div class="value">${fmt(totBrut)} FCFA</div>
  </div>
  <div class="sum-box danger">
    <div class="label">Total CNSS à verser (art. 44 CNSS)</div>
    <div class="value">${fmt(totCnss)} FCFA</div>
  </div>
  <div class="sum-box">
    <div class="label">IRPP à reverser DGI (art. 76 CGI)</div>
    <div class="value">${fmt(totIrpp)} FCFA</div>
  </div>
  <div class="sum-box danger">
    <div class="label">Total à décaisser</div>
    <div class="value">${fmt(totCnss + totIrpp)} FCFA</div>
  </div>
</div>

<div class="signatures">
  <div class="sig-box">
    <strong>Cachet &amp; Signature Employeur</strong>
    <div style="height:48px;border:1px dashed #ccc;border-radius:4px;margin-top:4px"></div>
    <div style="margin-top:4px">Date: ___/___/______</div>
  </div>
  <div class="sig-box">
    <strong>Visa CNSS</strong>
    <div style="height:48px;border:1px dashed #ccc;border-radius:4px;margin-top:4px"></div>
    <div style="margin-top:4px">Date dépôt: ___/___/______  · Réf: ___________</div>
  </div>
  <div class="sig-box">
    <strong>Règlement (virement CNSS)</strong>
    <div style="height:48px;border:1px dashed #ccc;border-radius:4px;margin-top:4px"></div>
    <div style="margin-top:4px">Montant réglé: ___________________ FCFA</div>
  </div>
</div>

<div class="footer">
  Déclaration générée automatiquement par Oraforme ERP · Moteur SYSCOHADA Révisé 2017 · ${new Date().toLocaleString('fr-FR')}
  · Conformément aux articles 44 et suivants du Code CNSS et art. 76 CGI Congo-Brazzaville
</div>

</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
