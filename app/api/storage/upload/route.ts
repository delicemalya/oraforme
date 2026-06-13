/**
 * POST /api/storage/upload
 * Upload multipart d'un document vers le storage configuré (S3/R2/Wasabi/MinIO/Supabase).
 * Lance OCR asynchrone après l'upload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { uploadDocument } from '@/lib/storage/storage-service'
import type { DocCategory } from '@/lib/storage/storage-service'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const MAX_SIZE = 50 * 1024 * 1024  // 50 MB

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'FormData requis' }, { status: 400 })

  const file     = formData.get('file') as File | null
  const category = (formData.get('category') as DocCategory) ?? 'autre'
  const nom      = (formData.get('nom') as string) ?? ''
  const tags     = (formData.get('tags') as string)?.split(',').filter(Boolean) ?? []
  const dossierId = (formData.get('dossier_id') as string) ?? undefined
  const note     = (formData.get('note') as string) ?? undefined
  const confidentiel = formData.get('confidentiel') === 'true'

  if (!file) return NextResponse.json({ error: 'Fichier requis (champ "file")' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Format non supporté : ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `Fichier trop lourd (max 50 MB)` }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await uploadDocument({
    tenantId:    ctx.tid,
    file:        buffer,
    filename:    file.name,
    mimeType:    file.type,
    category,
    nom:         nom || file.name,
    dossierId,
    tags,
    confidentiel,
    userId:      ctx.userId,
    note,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  // Déclencher OCR en arrière-plan (non-bloquant)
  if (result.document?.id) {
    fetch(`${req.nextUrl.origin}/api/ocr/extract`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': 'true' },
      body:    JSON.stringify({ documentId: result.document.id, tenantId: ctx.tid }),
    }).catch(() => {})
  }

  return NextResponse.json({
    ok:       true,
    document: result.document,
  }, { status: 201 })
}
