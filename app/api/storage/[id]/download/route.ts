/**
 * GET /api/storage/[id]/download — URL présignée de téléchargement
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { downloadDocument } from '@/lib/storage/storage-service'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const res = await downloadDocument(id, ctx.tid, ctx.userId)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 })
  return NextResponse.json({ ok: true, url: res.url, expiresIn: res.expiresIn })
}
