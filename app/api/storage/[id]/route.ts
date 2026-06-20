/**
 * PATCH /api/storage/[id]  — archive | restore | rename
 * DELETE /api/storage/[id] — soft delete (ou hard avec ?hard=true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { archiveDocument, restoreDocument, deleteDocument } from '@/lib/storage/storage-service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const body = await req.json() as { action?: string; nom?: string }

  if (body.action === 'archive') {
    const res = await archiveDocument(id, ctx.tid, ctx.userId)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'restore') {
    const res = await restoreDocument(id, ctx.tid, ctx.userId)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Rename
  if (body.nom) {
     
    const db = (await import('@/lib/supabase-server')).supabaseAdmin as any
    const { error } = await db.from('documents').update({ nom: body.nom }).eq('id', id).eq('tenant_id', ctx.tid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const hard = new URL(req.url).searchParams.get('hard') === 'true'
  const res  = await deleteDocument(id, ctx.tid, hard, ctx.userId)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
