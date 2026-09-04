/**
 * POST /api/ocr/extract
 *
 * Deux modes :
 *   1. Fichier direct  : FormData { file, type?, documentId? }
 *   2. Document en DB  : JSON { documentId, tenantId } — appel serveur→serveur
 *      depuis /api/storage/upload, authentifié par le secret d'automatisation.
 *
 * Résultat stocké dans documents.ocr_text + documents.ocr_data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { requireAutomationSecret } from '@/lib/api/require-automation'
import { extractText } from '@/lib/ocr/ocr-engine'
import {
  detectDocumentType,
  extractInvoice, extractCV, extractContract,
  extractIdentityCard, extractFiscalDocument,
} from '@/lib/ocr/extractors'
import { supabaseAdmin } from '@/lib/supabase-server'
import { downloadDocument } from '@/lib/storage/storage-service'

 
const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // OCR peut prendre du temps

export async function POST(req: NextRequest) {
  // §22.1 — le mode interne acceptait un tenantId du corps de requête dès que
  // l'en-tête `x-internal: true` était présent. Ce n'est pas un secret : tout
  // compte authentifié pouvait lire et écrire les documents d'un autre tenant.
  // Le mode interne exige désormais le secret d'automatisation.
  const isInternal = requireAutomationSecret(req) === null

  let tenantId: string
  let fileBuffer: Buffer | null = null
  let mimeType  = ''
  let filename  = ''
  let docType: string | undefined
  let documentId: string | undefined

  if (isInternal) {
    // Appel interne : { documentId, tenantId }
    const body = await req.json() as { documentId: string; tenantId: string }
    tenantId   = body.tenantId
    documentId = body.documentId
  } else {
    const ctx = await requireTenant(req)
    if (!ctx.ok) return ctx.error
    tenantId = ctx.tid

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null)
      if (!formData) return NextResponse.json({ error: 'FormData requis' }, { status: 400 })

      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })

      fileBuffer = Buffer.from(await file.arrayBuffer())
      mimeType   = file.type
      filename   = file.name
      docType    = (formData.get('type') as string) ?? undefined
      documentId = (formData.get('document_id') as string) ?? undefined
    } else {
      const body = await req.json() as { documentId?: string; type?: string }
      documentId = body.documentId
      docType    = body.type
    }
  }

  // Si document en DB, récupérer le fichier
  if (!fileBuffer && documentId) {
    const { data: doc } = await db
      .from('documents')
      .select('storage_key,storage_provider,url,mime_type,nom,ocr_status')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    if (doc.ocr_status === 'done') return NextResponse.json({ ok: true, cached: true })

    mimeType = doc.mime_type ?? 'application/pdf'
    filename = doc.nom ?? 'document'

    // Marquer en cours
    await db.from('documents').update({ ocr_status: 'processing' })
      .eq('id', documentId).eq('tenant_id', tenantId)

    // Télécharger le fichier
    const dlRes = await downloadDocument(documentId, tenantId)
    if (!dlRes.ok || !dlRes.url) {
      await db.from('documents').update({ ocr_status: 'error' })
        .eq('id', documentId).eq('tenant_id', tenantId)
      return NextResponse.json({ error: 'Impossible de télécharger le document' }, { status: 500 })
    }

    try {
      const res = await fetch(dlRes.url)
      fileBuffer = Buffer.from(await res.arrayBuffer())
    } catch {
      await db.from('documents').update({ ocr_status: 'error' })
        .eq('id', documentId).eq('tenant_id', tenantId)
      return NextResponse.json({ error: 'Erreur téléchargement fichier' }, { status: 500 })
    }
  }

  if (!fileBuffer) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })

  // ── Extraction OCR ──────────────────────────────────────────────────────────
  const ocr = await extractText({ type: 'buffer', data: fileBuffer, mimeType, filename })

  if (!ocr.text) {
    if (documentId) await db.from('documents').update({ ocr_status: 'error' }).eq('id', documentId).eq('tenant_id', tenantId)
    return NextResponse.json({ ok: false, error: ocr.error ?? 'Aucun texte extrait', provider: ocr.provider })
  }

  // ── Auto-détection type + extraction structurée ─────────────────────────────
  const detected = docType ? { type: docType, confidence: 1 } : await detectDocumentType(ocr.text)

  let structured: Record<string, unknown> = {}
  let suggestion: string | undefined

  try {
    switch (detected.type) {
      case 'invoice': {
        const inv  = await extractInvoice(ocr.text)
        structured = inv as unknown as Record<string, unknown>
        suggestion = inv.suggestion ?? undefined
        break
      }
      case 'cv': {
        const cv = await extractCV(ocr.text)
        structured = cv as unknown as Record<string, unknown>
        suggestion = `CV de ${(cv as unknown as Record<string, unknown>).nom as string ?? '?'} — Score : ${(cv as unknown as Record<string, unknown>).score as number ?? '?'}/100. Ajouter à la base candidates ?`
        break
      }
      case 'contract': {
        const ct = await extractContract(ocr.text)
        structured = ct as unknown as Record<string, unknown>
        suggestion = `Contrat ${structured.type as string ?? ''} détecté. ${(structured.risques as string[])?.length ? 'Risques identifiés !' : 'Aucun risque majeur.'} Voir le rapport ?`
        break
      }
      case 'identity': {
        const id = await extractIdentityCard(ocr.text)
        structured = id as unknown as Record<string, unknown>
        suggestion = `Pièce d'identité de ${structured.prenom as string ?? ''} ${structured.nom as string ?? ''} — enregistrée.`
        break
      }
      case 'fiscal': {
        const fsc = await extractFiscalDocument(ocr.text)
        structured = fsc as unknown as Record<string, unknown>
        suggestion = `Document fiscal ${structured.type as string ?? ''} pour ${structured.periode as string ?? '?'}. Montant : ${structured.montant as string ?? '?'}. Enregistrer dans le calendrier fiscal ?`
        break
      }
      default:
        structured = {}
    }
  } catch { /* extraction structurée non bloquante */ }

  // Mapper detected.type → DocCategory pour la BDD
  const DETECTED_TO_CATEGORY: Record<string, string> = {
    invoice:  'facture',
    cv:       'cv',
    contract: 'contrat',
    identity: 'photo',
    fiscal:   'fiscal',
  }
  const categorie = DETECTED_TO_CATEGORY[detected.type] ?? 'autre'

  // ── Sauvegarder en DB ───────────────────────────────────────────────────────
  if (documentId) {
    await db.from('documents').update({
      ocr_text:   ocr.text,
      ocr_status: 'done',
      categorie,
      ocr_data: {
        provider:    ocr.provider,
        confidence:  ocr.confidence,
        detected:    detected.type,
        structured,
        suggestion,
        processed_at: new Date().toISOString(),
      },
    }).eq('id', documentId).eq('tenant_id', tenantId)

    // Ajouter à l'historique
    await db.from('document_history').insert({
      document_id: documentId,
      tenant_id:   tenantId,
      action:      'ocr',
      metadata: { provider: ocr.provider, detected: detected.type, chars: ocr.text.length },
    })
  }

  return NextResponse.json({
    ok:         true,
    provider:   ocr.provider,
    text:       ocr.text.slice(0, 500) + (ocr.text.length > 500 ? '…' : ''),
    fullText:   ocr.text,
    detected:   detected.type,
    structured,
    suggestion,
    confidence: ocr.confidence,
  })
}
