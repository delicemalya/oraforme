/**
 * POST /api/storage/presign
 * Génère une URL présignée pour upload direct client → S3 (fichiers > 4MB).
 * Le client confirme l'upload via PATCH /api/storage/presign avec la clé retournée.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { presignUpload } from '@/lib/storage/storage-service'
import type { DocCategory } from '@/lib/storage/storage-service'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json() as {
    filename: string
    mimeType: string
    category?: DocCategory
    fileSize?: number
  }

  if (!body.filename || !body.mimeType) {
    return NextResponse.json({ error: 'filename et mimeType requis' }, { status: 400 })
  }

  const result = await presignUpload(
    ctx.tid,
    body.category ?? 'autre',
    body.filename,
    body.mimeType,
  )

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ ok: true, uploadUrl: result.url, key: result.key })
}

/**
 * PATCH /api/storage/presign
 * Confirme l'upload direct et enregistre les métadonnées en DB.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json() as {
    key:      string
    filename: string
    mimeType: string
    fileSize: number
    category?: DocCategory
    nom?:     string
    tags?:    string[]
    dossierId?: string
  }

  if (!body.key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

   
  const db = (await import('@/lib/supabase-server')).supabaseAdmin as any
  const { createStorageProvider } = await import('@/lib/storage/storage-provider')
  const storage = await createStorageProvider(ctx.tid)
  const urlRes  = await storage.presignDownload(body.key, 3600 * 24 * 7)

  const { data: doc, error } = await db.from('documents').insert({
    tenant_id:        ctx.tid,
    nom:              body.nom || body.filename,
    url:              urlRes.url || '',
    storage_key:      body.key,
    storage_provider: storage.provider,
    storage_bucket:   body.key.split('/')[0],
    mime_type:        body.mimeType,
    file_size:        body.fileSize,
    categorie:        body.category ?? 'autre',
    type:             body.category ?? 'autre',
    tags:             body.tags ?? [],
    statut:           'actif',
    ocr_status:       'pending',
    version:          1,
    dossier_id:       body.dossierId ?? null,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, document: doc }, { status: 201 })
}
