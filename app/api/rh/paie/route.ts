import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../hr/_auth'

/* ─────────────────────────────────────────────────────────────────────────────
 * SYSCOHADA helper — écritures paie conformes SYSCOHADA révisé 2017
 *
 * Écriture paie Congo-Brazzaville (comptes SYSCOHADA 2-5 chiffres) :
 *   - 661 Rémunérations directes / 422 Personnel rémunérations dues  [brut]
 *   - 664 Charges sociales CNSS patronal / 431 CNSS                  [patronal]
 *   - 422 Personnel rémunérations dues / 521 Banque                  [net]
 *   - 447 Impôts retenus à la source / 521 Banque                    [IRPP]
 * ─────────────────────────────────────────────────────────────────────────── */

interface OhadaWriteInput {
  tenantId:      string
  date:          string
  libelle:       string
  montant:       number
  debitAccount:  string
  creditAccount: string
  source:        string
  sourceId?:     string
}

async function writeOhadaEntryAdmin(input: OhadaWriteInput): Promise<{ ok: boolean; error?: string }> {
  const fiscalYear = new Date(input.date).getFullYear()
  const categorie  = '661 — Rémunérations directes versées au personnel'

  try {
    // 1. journal_comptable
    const { error: jcErr } = await supabaseAdmin.from('journal_comptable').insert({
      tenant_id:      input.tenantId,
      date:           input.date,
      libelle:        input.libelle,
      type:           'depense',
      montant_ht:     input.montant,
      tva:            0,
      ca:             0,
      montant_ttc:    input.montant,
      categorie,
      debit_account:  input.debitAccount,
      credit_account: input.creditAccount,
      source:         input.source,
      source_id:      input.sourceId ?? null,
    })
    if (jcErr) return { ok: false, error: `journal_comptable: ${jcErr.message}` }

    // 2. journal_entries
    const { error: jeErr } = await supabaseAdmin.from('journal_entries').insert({
      tenant_id:       input.tenantId,
      date_operation:  input.date,
      libelle:         input.libelle,
      debit_account:   input.debitAccount,
      credit_account:  input.creditAccount,
      montant:         input.montant,
      source:          input.source,
      source_id:       input.sourceId ?? null,
      fiscal_year:     fiscalYear,
    })
    if (jeErr) return { ok: false, error: `journal_entries: ${jeErr.message}` }

    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return { ok: false, error: msg }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/rh/paie
 * ─────────────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mois   = searchParams.get('mois')
  const annee  = searchParams.get('annee')
  const statut = searchParams.get('statut')
  const limit  = parseInt(searchParams.get('limit') || '100')

  let query = supabaseAdmin
    .from('bulletins_paie')
    .select('*, employes(nom, poste, matricule, departement)')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (mois)   query = query.eq('mois', parseInt(mois))
  if (annee)  query = query.eq('annee', parseInt(annee))
  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/rh/paie
 * Crée un bulletin de paie + génère automatiquement 3 écritures OHADA
 * ─────────────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    employe_id, mois, annee,
    brut, cnss_salarie, cnss_patronal, irpp, net,
    primes, heures_sup, taux_horaire,
    mode_paiement,
  } = body

  if (!employe_id) return NextResponse.json({ error: 'employe_id requis' }, { status: 400 })
  if (!mois || !annee) return NextResponse.json({ error: 'mois et annee requis' }, { status: 400 })
  if (!brut || Number(brut) < 0) return NextResponse.json({ error: 'brut invalide' }, { status: 400 })

  // Verify employee belongs to this tenant
  const { data: emp } = await supabaseAdmin
    .from('employes')
    .select('id, nom, poste, matricule')
    .eq('id', employe_id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })

  // Check duplicate
  const { data: dup } = await supabaseAdmin
    .from('bulletins_paie')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('employe_id', employe_id)
    .eq('mois', mois)
    .eq('annee', annee)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: `Bulletin ${mois}/${annee} déjà créé pour cet employé` }, { status: 409 })

  /* ── Valeurs numériques ───────────────────────────────────────────────── */
  const numBrut        = Number(brut)
  const numNet         = Number(net)         || numBrut
  const numCnssSalarie = Number(cnss_salarie)  || 0
  const numCnssPatron  = Number(cnss_patronal) || 0
  const numIrpp        = Number(irpp)          || 0
  const numPrimes      = Number(primes)        || 0
  const numHeuresSup   = Number(heures_sup)    || 0
  const numTauxHoraire = Number(taux_horaire)  || 0
  const modePaie       = mode_paiement || 'virement'

  /* ── Insérer le bulletin ─────────────────────────────────────────────── */
  const { data: bulletin, error: bulErr } = await supabaseAdmin
    .from('bulletins_paie')
    .insert({
      tenant_id:      auth.tenantId,
      employe_id,
      mois:           parseInt(mois),
      annee:          parseInt(annee),
      brut:           numBrut,
      cnss_salarie:   numCnssSalarie,
      cnss_patronal:  numCnssPatron,
      irpp:           numIrpp,
      net:            numNet,
      primes:         numPrimes,
      heures_sup:     numHeuresSup,
      taux_horaire:   numTauxHoraire,
      mode_paiement:  modePaie,
      statut:         'generee',
    })
    .select('*, employes(nom, poste, matricule)')
    .single()

  if (bulErr) return NextResponse.json({ error: bulErr.message }, { status: 500 })

  /* ── Compte trésorerie selon mode de paiement ───────────────────────── */
  const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const moisLabel = MOIS_LABELS[(parseInt(mois) - 1)] ?? `M${mois}`
  const dateOp    = new Date().toISOString().slice(0, 10)
  const empNom    = emp.nom ?? 'Employé'

  function modeToAccount(mode: string): string {
    switch (mode.toLowerCase()) {
      case 'virement':     return '521'
      case 'cheque':       return '512'
      case 'especes':      return '571'
      case 'airtel_money': return '541'
      case 'mtn_momo':     return '542'
      case 'mobile_money': return '543'
      default:             return '521'
    }
  }
  const compteBank = modeToAccount(modePaie)
  const bulletinId = bulletin.id

  /* ── 3 ÉCRITURES OHADA AUTOMATIQUES ─────────────────────────────────── */

  /**
   * Écriture 1 — Constatation salaire brut (SYSCOHADA)
   *   Débit  661 Rémunérations directes versées au personnel  → brut
   *   Crédit 422 Personnel — rémunérations dues
   */
  const e1 = await writeOhadaEntryAdmin({
    tenantId:      auth.tenantId,
    date:          dateOp,
    libelle:       `Salaire ${moisLabel} ${annee} — ${empNom}`,
    montant:       numBrut,
    debitAccount:  '661',
    creditAccount: '422',
    source:        'paie',
    sourceId:      bulletinId,
  })

  /**
   * Écriture 2 — Charges patronales CNSS (SYSCOHADA)
   *   Débit  664 Charges sociales — CNSS patronal
   *   Crédit 431 CNSS — cotisations sociales
   */
  const ohadaErrors: string[] = []
  if (!e1.ok && e1.error) ohadaErrors.push(e1.error)

  if (numCnssPatron > 0) {
    const e2 = await writeOhadaEntryAdmin({
      tenantId:      auth.tenantId,
      date:          dateOp,
      libelle:       `CNSS patronal ${moisLabel} ${annee} — ${empNom}`,
      montant:       numCnssPatron,
      debitAccount:  '664',
      creditAccount: '431',
      source:        'paie',
      sourceId:      bulletinId,
    })
    if (!e2.ok && e2.error) ohadaErrors.push(e2.error)
  }

  /**
   * Écriture 3 — Paiement net (décaissement) SYSCOHADA
   *   Débit  422 Personnel — rémunérations dues   → net
   *   Crédit 521/512/571/541/542/543 selon mode paiement
   */
  const e3 = await writeOhadaEntryAdmin({
    tenantId:      auth.tenantId,
    date:          dateOp,
    libelle:       `Paiement salaire ${moisLabel} ${annee} — ${empNom} (${modePaie})`,
    montant:       numNet,
    debitAccount:  '422',
    creditAccount: compteBank,
    source:        'paie',
    sourceId:      bulletinId,
  })
  if (!e3.ok && e3.error) ohadaErrors.push(e3.error)

  /**
   * Écriture 4 — IRPP retenu à la source (SYSCOHADA)
   *   Débit  447 État — impôts retenus à la source
   *   Crédit 521 Banque (à reverser à la DGI)
   */
  if (numIrpp > 0) {
    const e4 = await writeOhadaEntryAdmin({
      tenantId:      auth.tenantId,
      date:          dateOp,
      libelle:       `IRPP ${moisLabel} ${annee} — ${empNom}`,
      montant:       numIrpp,
      debitAccount:  '447',
      creditAccount: '521',
      source:        'paie',
      sourceId:      bulletinId,
    })
    if (!e4.ok && e4.error) ohadaErrors.push(e4.error)
  }

  return NextResponse.json({
    success: true,
    data: bulletin,
    ohada: {
      written: ohadaErrors.length === 0,
      errors:  ohadaErrors.length > 0 ? ohadaErrors : undefined,
      entries: [
        `661/422 Salaire brut: ${numBrut} FCFA`,
        numCnssPatron > 0 ? `664/431 CNSS patronal: ${numCnssPatron} FCFA` : null,
        `422/${compteBank} Net payé: ${numNet} FCFA`,
        numIrpp > 0 ? `447/521 IRPP: ${numIrpp} FCFA` : null,
      ].filter(Boolean),
    },
  }, { status: 201 })
}
