/**
 * GET  /api/storage/config — lecture config stockage (secrets masqués)
 * POST /api/storage/config — sauvegarde config
 * POST /api/storage/config?test=true — test connexion
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

 
const db = supabaseAdmin as any

function mask(s: string): string {
  if (!s || s.length < 6) return s
  return s.slice(0, 4) + '••••••••' + s.slice(-4)
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { data } = await db
    .from('storage_configs')
    .select('provider,s3_endpoint,s3_bucket,s3_region,s3_access_key,s3_secret_key,public_url,actif,updated_at')
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (!data) return NextResponse.json({ config: null })
  return NextResponse.json({
    config: {
      ...data,
      s3_access_key: mask(data.s3_access_key ?? ''),
      s3_secret_key: mask(data.s3_secret_key ?? ''),
    },
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const isTest = new URL(req.url).searchParams.get('test') === 'true'
  const body   = await req.json() as {
    provider?:    string
    s3_endpoint?: string
    s3_bucket?:   string
    s3_region?:   string
    s3_access_key?: string
    s3_secret_key?: string
    public_url?:  string
    actif?:       boolean
  }

  // Ne pas écraser les clés masquées
  const { data: existing } = await db
    .from('storage_configs')
    .select('s3_access_key,s3_secret_key')
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    tenant_id:    ctx.tid,
    provider:     body.provider    ?? 's3',
    s3_endpoint:  body.s3_endpoint ?? '',
    s3_bucket:    body.s3_bucket   ?? '',
    s3_region:    body.s3_region   ?? 'auto',
    public_url:   body.public_url  ?? null,
    actif:        body.actif       ?? false,
  }

  payload.s3_access_key = (body.s3_access_key && !body.s3_access_key.includes('••'))
    ? body.s3_access_key : (existing?.s3_access_key ?? '')
  payload.s3_secret_key = (body.s3_secret_key && !body.s3_secret_key.includes('••'))
    ? body.s3_secret_key : (existing?.s3_secret_key ?? '')

  // Test connexion avant de sauvegarder
  if (isTest) {
    try {
      const { S3Client, ListObjectVersionsCommand } = await import('@aws-sdk/client-s3')
      const s3 = new S3Client({
        region:   String(payload.s3_region),
        endpoint: String(payload.s3_endpoint),
        credentials: {
          accessKeyId:     String(payload.s3_access_key),
          secretAccessKey: String(payload.s3_secret_key),
        },
        forcePathStyle: payload.provider === 'minio',
      })
      await s3.send(new ListObjectVersionsCommand({ Bucket: String(payload.s3_bucket), MaxKeys: 1 }))
      return NextResponse.json({ ok: true, message: `Connexion réussie au bucket "${payload.s3_bucket}"` })
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 422 })
    }
  }

  let error
  if (existing) {
    ;({ error } = await db.from('storage_configs').update(payload).eq('tenant_id', ctx.tid))
  } else {
    ;({ error } = await db.from('storage_configs').insert(payload))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
