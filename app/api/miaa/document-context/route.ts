/**
 * GET /api/miaa/document-context?documentId=xxx
 *
 * Récupère le contexte OCR d'un document GED pour l'injecter dans MIAA.
 * Retourne : { context, suggestion, detected, structured }
 *
 * POST /api/miaa/document-context
 * Body: { documentId, question }
 * Analyse directement le document via MIAA en injectant le texte OCR comme contexte.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dynamic = 'force-dynamic'

// ── GET : récupérer le contexte d'un document ────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const documentId = req.nextUrl.searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'documentId requis' }, { status: 400 })

  const { data: doc } = await db
    .from('documents')
    .select('id,nom,categorie,mime_type,ocr_text,ocr_data,ocr_status,statut,created_at')
    .eq('id', documentId)
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (doc.statut === 'supprime') return NextResponse.json({ error: 'Document supprimé' }, { status: 410 })

  if (!doc.ocr_text) {
    return NextResponse.json({
      ok:      false,
      status:  doc.ocr_status,
      message: doc.ocr_status === 'pending' ? 'OCR en attente — réessayez dans quelques secondes.' : 'Aucun texte extrait de ce document.',
    }, { status: 202 })
  }

  const ocrData = doc.ocr_data as Record<string, unknown> | null
  const context = buildContext(doc.nom, doc.categorie, doc.ocr_text, ocrData)

  return NextResponse.json({
    ok:         true,
    context,
    detected:   ocrData?.detected ?? doc.categorie,
    structured: ocrData?.structured ?? null,
    suggestion: ocrData?.suggestion ?? null,
    chars:      (doc.ocr_text as string).length,
  })
}

// ── POST : poser une question à MIAA sur un document déjà en GED ─────────────

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json() as { documentId?: string; question?: string; messages?: unknown[] }
  if (!body.documentId) return NextResponse.json({ error: 'documentId requis' }, { status: 400 })

  const question = body.question?.trim() || 'Analyse ce document et résume les points clés.'

  const { data: doc } = await db
    .from('documents')
    .select('nom,categorie,ocr_text,ocr_data')
    .eq('id', body.documentId)
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  if (!doc.ocr_text) {
    return NextResponse.json({
      ok:      false,
      answer:  'Ce document n\'a pas encore été analysé par OCR. Veuillez patienter quelques secondes et réessayer.',
    })
  }

  const ocrData  = doc.ocr_data as Record<string, unknown> | null
  const context  = buildContext(doc.nom, doc.categorie, doc.ocr_text, ocrData)

  const systemPrompt = `Tu es MIAA, l'assistant intelligent d'Oraforme ERP (contexte Congo/OHADA/CEMAC).
Un document a été uploadé dans la GED et analysé par OCR. Voici son contenu :

${context}

Réponds en français. Sois précis et pratique. Si des données chiffrées sont présentes, calcule et vérifie.`

  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: question }],
  })

  const answer = res.content[0]?.type === 'text' ? res.content[0].text : ''

  return NextResponse.json({
    ok:       true,
    answer,
    detected: ocrData?.detected ?? doc.categorie,
    model:    'claude-haiku',
  })
}

// ── Helper : formater le contexte OCR pour injection dans MIAA ───────────────

function buildContext(
  nom:      string,
  categorie: string,
  ocrText:  string,
  ocrData:  Record<string, unknown> | null,
): string {
  const lines: string[] = [
    `📄 Document : ${nom}`,
    `📂 Catégorie : ${categorie}`,
  ]

  if (ocrData?.detected) {
    lines.push(`🔍 Type détecté : ${ocrData.detected}`)
  }

  if (ocrData?.structured && Object.keys(ocrData.structured as object).length > 0) {
    lines.push('\n📊 Données structurées extraites :')
    lines.push(JSON.stringify(ocrData.structured, null, 2).slice(0, 1500))
  }

  lines.push('\n📝 Texte complet du document :')
  lines.push('---')
  lines.push((ocrText as string).slice(0, 6000))
  if ((ocrText as string).length > 6000) lines.push('... [texte tronqué]')
  lines.push('---')

  return lines.join('\n')
}
