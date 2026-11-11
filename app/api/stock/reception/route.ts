import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// ── POST /api/stock/reception ────────────────────────────────────────────────
// BOI-004 (docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md, Principe #4, décision C) :
// « réception » n'est plus une entité distincte (stock_receptions/
// stock_reception_items n'ont jamais existé en base — l'ancienne implémentation
// de cette route échouait sur le tout premier INSERT). Une réception est
// désormais la transition purchases.statut → 'reçu' d'un achat déjà créé via
// POST /api/stocks/purchases. Cette route reste en place pour ne pas casser un
// éventuel appelant existant, mais délègue entièrement à la route canonique.
export async function POST(req: NextRequest) {
  const { error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const purchaseId: string | undefined = body.purchase_id ?? body.purchase_order_id ?? undefined

  if (!purchaseId) {
    return NextResponse.json(
      {
        error:
          'Le flux réception a changé (BOI-004) : il n\'existe plus de création de réception autonome. ' +
          'Créez un achat via POST /api/stocks/purchases, puis passez-le à \'reçu\' via ' +
          'PATCH /api/stocks/purchases { id, statut: "reçu" } — cette transition déclenche ' +
          'automatiquement l\'entrée en stock et l\'écriture comptable. ' +
          'Pour compatibilité, cette route accepte { purchase_id } et délègue à cette transition.',
      },
      { status: 410 },
    )
  }

  const origin = new URL(req.url).origin
  const res = await fetch(`${origin}/api/stocks/purchases`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
    body:    JSON.stringify({ id: purchaseId, statut: 'reçu' }),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
