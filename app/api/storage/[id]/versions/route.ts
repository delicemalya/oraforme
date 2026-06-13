/**
 * GET  /api/storage/[id]/versions — liste des versions
 * POST /api/storage/[id]/versions — uploader une nouvelle version
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { getDocumentVersions, addDocumentVersion } from '@/lib/storage/storage-service'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const versions = await getDocumentVersions(id, ctx.tid)
  return NextResponse.json({ versions })
}

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'FormData requis' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const note   = (formData.get('note') as string) ?? undefined

  const res = await addDocumentVersion(id, {
    tenantId: ctx.tid,
    file:     buffer,
    filename: file.name,
    mimeType: file.type,
    userId:   ctx.userId,
    note,
  })

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true, version: res.version }, { status: 201 })
}
