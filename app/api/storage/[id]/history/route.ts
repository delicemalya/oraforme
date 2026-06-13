/**
 * GET /api/storage/[id]/history — audit trail complet d'un document
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { getDocumentHistory } from '@/lib/storage/storage-service'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const history = await getDocumentHistory(id, ctx.tid)
  return NextResponse.json({ history })
}
