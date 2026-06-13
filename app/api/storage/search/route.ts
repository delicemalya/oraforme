/**
 * GET /api/storage/search?q=...&category=...&statut=...
 * Moteur de recherche intelligent : nom, tags, contenu OCR full-text.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { searchDocuments } from '@/lib/storage/storage-service'
import type { DocCategory } from '@/lib/storage/storage-service'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q') ?? ''
  const category = searchParams.get('category') as DocCategory | undefined
  const statut   = searchParams.get('statut') ?? undefined
  const dateFrom = searchParams.get('from') ?? undefined
  const dateTo   = searchParams.get('to')   ?? undefined

  const results = await searchDocuments(ctx.tid, q, { category, statut, dateFrom, dateTo })
  return NextResponse.json({ results, total: results.length })
}
