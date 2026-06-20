/**
 * GET /api/comptabilite/grand-livre
 *
 * Grand Livre SYSCOHADA — Détail des mouvements par compte.
 * Utilisé par MIAA pour analyser les écritures et détecter les anomalies.
 *
 * Paramètres :
 *   ?annee=2026             — exercice fiscal
 *   ?compte=411             — filtrer un compte précis (optionnel)
 *   ?classe=4               — filtrer une classe (optionnel)
 *   ?anomalies=true         — retourner seulement les anomalies
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { COMPTES_PLATS } from '@/lib/syscohada/plan-comptable'

 
const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'

export interface JournalEntry {
  id:             string
  date_operation: string
  libelle:        string
  debit_account:  string
  credit_account: string
  montant:        number
  reference?:     string
  source?:        string
  journal_type?:  string
}

export interface GrandLivreCompte {
  numero:       string
  nom:          string
  classe:       number
  type:         string
  total_debit:  number
  total_credit: number
  solde:        number
  mouvements:   JournalEntry[]
  anomalies:    string[]
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const sp            = req.nextUrl.searchParams
  const year          = parseInt(sp.get('annee') ?? String(new Date().getFullYear()))
  const compteFilter  = sp.get('compte') ?? null
  const classeFilter  = sp.get('classe') ?? null
  const anomaliesOnly = sp.get('anomalies') === 'true'
  const limit         = Math.min(parseInt(sp.get('limit') ?? '1000'), 5000)

  // Charger les écritures
  let q = db
    .from('journal_entries')
    .select('id, date_operation, libelle, debit_account, credit_account, montant, reference, source, journal_type')
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', year)
    .order('date_operation', { ascending: true })
    .limit(limit)

  if (compteFilter) {
    q = q.or(`debit_account.eq.${compteFilter},credit_account.eq.${compteFilter}`)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Grouper par compte
  const map = new Map<string, { debits: JournalEntry[]; credits: JournalEntry[]; total_debit: number; total_credit: number }>()

  for (const e of entries ?? [] as JournalEntry[]) {
    if (e.debit_account) {
      const k = e.debit_account
      if (!map.has(k)) map.set(k, { debits: [], credits: [], total_debit: 0, total_credit: 0 })
      const g = map.get(k)!
      g.debits.push(e)
      g.total_debit += e.montant ?? 0
    }
    if (e.credit_account) {
      const k = e.credit_account
      if (!map.has(k)) map.set(k, { debits: [], credits: [], total_debit: 0, total_credit: 0 })
      const g = map.get(k)!
      g.credits.push(e)
      g.total_credit += e.montant ?? 0
    }
  }

  // Construire les comptes
  const comptes: GrandLivreCompte[] = []

  for (const [numero, data] of map.entries()) {
    const classe = parseInt(numero[0]) || 0
    if (classeFilter && String(classe) !== classeFilter) continue

    const sc   = COMPTES_PLATS.find(c => c.numero === numero)
    const nom  = sc?.nom ?? numero
    const type = sc?.type ?? '—'

    const solde = data.total_debit - data.total_credit

    // Toutes les écritures du compte (déduplication par id)
    const allMovements = new Map<string, JournalEntry>()
    for (const e of [...data.debits, ...data.credits]) {
      allMovements.set(e.id, e)
    }
    const mouvements = Array.from(allMovements.values()).sort(
      (a, b) => a.date_operation.localeCompare(b.date_operation)
    )

    // Anomalies au niveau du compte
    const anomalies: string[] = []

    // Écritures sans libellé
    const sanslibelle = mouvements.filter(m => !m.libelle?.trim())
    if (sanslibelle.length > 0) {
      anomalies.push(`${sanslibelle.length} écriture(s) sans libellé (SYSCOHADA Art. 17)`)
    }

    // Solde anormal selon type de compte
    if (classe >= 6 && solde < 0) {
      anomalies.push(`Compte de charges ${numero} avec solde créditeur (${Math.round(-solde).toLocaleString('fr-FR')} FCFA) — inversé ?`)
    }
    if (classe === 7 && solde > 0) {
      anomalies.push(`Compte de produits ${numero} avec solde débiteur (${Math.round(solde).toLocaleString('fr-FR')} FCFA) — inversé ?`)
    }
    if (classe === 4 && numero.startsWith('4441') && solde < 0) {
      anomalies.push(`TVA facturée (4441) avec solde débiteur — probable erreur d'écriture`)
    }

    const compte: GrandLivreCompte = {
      numero,
      nom,
      classe,
      type,
      total_debit:  data.total_debit,
      total_credit: data.total_credit,
      solde,
      mouvements,
      anomalies,
    }

    if (!anomaliesOnly || anomalies.length > 0) {
      comptes.push(compte)
    }
  }

  // Trier par numéro de compte
  comptes.sort((a, b) => a.numero.localeCompare(b.numero))

  const totalAnomalies = comptes.reduce((s, c) => s + c.anomalies.length, 0)

  return NextResponse.json({
    ok:              true,
    comptes,
    nb_comptes:      comptes.length,
    nb_ecritures:    (entries ?? []).length,
    total_anomalies: totalAnomalies,
    fiscal_year:     year,
    compte_filter:   compteFilter,
  })
}
