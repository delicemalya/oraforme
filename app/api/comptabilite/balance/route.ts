/**
 * GET /api/comptabilite/balance
 *
 * Balance générale SYSCOHADA — agrégation serveur de journal_entries.
 * Retourne totaux débit/crédit/solde par compte pour une année/mois donnés.
 * Utilisé par MIAA Compliance pour l'analyse automatisée.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { COMPTES_PLATS } from '@/lib/syscohada/plan-comptable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'

export interface BalanceLine {
  numero:       string
  nom:          string
  classe:       number
  type:         string
  total_debit:  number
  total_credit: number
  solde_debiteur:  number
  solde_crediteur: number
}

export interface BalanceResult {
  lignes:           BalanceLine[]
  total_debit:      number
  total_credit:     number
  equilibre:        boolean
  ecart:            number
  nb_comptes:       number
  fiscal_year:      number
  mois?:            number
  anomalies_solde:  string[]   // comptes avec solde anormal pour leur type
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const sp         = req.nextUrl.searchParams
  const year       = parseInt(sp.get('annee') ?? String(new Date().getFullYear()))
  const mois       = sp.get('mois') ? parseInt(sp.get('mois')!) : undefined
  const classeFilter = sp.get('classe') ?? null

  // Charger les écritures du journal
  let q = db
    .from('journal_entries')
    .select('debit_account, credit_account, montant, date_operation')
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', year)

  if (mois) {
    const monthStr = String(mois).padStart(2, '0')
    q = q
      .gte('date_operation', `${year}-${monthStr}-01`)
      .lte('date_operation', `${year}-${monthStr}-31`)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agréger par compte
  const map = new Map<string, { debit: number; credit: number }>()

  for (const e of entries ?? []) {
    if (e.debit_account) {
      const acc = map.get(e.debit_account) ?? { debit: 0, credit: 0 }
      acc.debit += e.montant ?? 0
      map.set(e.debit_account, acc)
    }
    if (e.credit_account) {
      const acc = map.get(e.credit_account) ?? { debit: 0, credit: 0 }
      acc.credit += e.montant ?? 0
      map.set(e.credit_account, acc)
    }
  }

  // Construire les lignes de balance
  const lignes: BalanceLine[] = []
  const anomalies_solde: string[] = []

  for (const [numero, { debit, credit }] of map.entries()) {
    const classe = parseInt(numero[0]) || 0
    if (classeFilter && String(classe) !== classeFilter) continue

    const sc   = COMPTES_PLATS.find(c => c.numero === numero)
    const nom  = sc?.nom ?? numero
    const type = sc?.type ?? '—'

    const solde_debiteur  = Math.max(0, debit - credit)
    const solde_crediteur = Math.max(0, credit - debit)

    // Détecter les soldes anormaux selon le sens normal du compte
    const solde = debit - credit
    if (sc) {
      // Actif (cl 1-5 débit) et Charges (cl 6-8) → solde normalement débiteur
      const shouldBeDebit = classe >= 6 || (classe >= 1 && classe <= 5 && ['actif'].includes(type?.toLowerCase() ?? ''))
      if (shouldBeDebit && solde < 0 && Math.abs(solde) > 1000) {
        anomalies_solde.push(`${numero} ${nom} — solde créditeur anormal (${credit - debit > 0 ? '+' : ''}${Math.round(credit - debit).toLocaleString('fr-FR')} FCFA)`)
      }
    }

    lignes.push({ numero, nom, classe, type, total_debit: debit, total_credit: credit, solde_debiteur, solde_crediteur })
  }

  // Trier par numéro de compte
  lignes.sort((a, b) => a.numero.localeCompare(b.numero))

  const total_debit  = lignes.reduce((s, l) => s + l.total_debit, 0)
  const total_credit = lignes.reduce((s, l) => s + l.total_credit, 0)
  const ecart        = Math.abs(total_debit - total_credit)
  const equilibre    = ecart < 1  // tolérance 1 FCFA (arrondi)

  return NextResponse.json({
    ok: true,
    lignes,
    total_debit,
    total_credit,
    equilibre,
    ecart,
    nb_comptes:    lignes.length,
    nb_ecritures:  (entries ?? []).length,
    fiscal_year:   year,
    mois,
    anomalies_solde,
  } satisfies { ok: boolean } & BalanceResult & { nb_ecritures: number })
}
