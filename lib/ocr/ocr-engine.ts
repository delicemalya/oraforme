/**
 * lib/ocr/ocr-engine.ts
 *
 * Moteur OCR avec fallback automatique :
 *   1. Mistral Pixtral (vision IA — meilleur résultat)
 *   2. Claude Vision (Anthropic — fallback IA)
 *   3. Tesseract.js (local — fallback hors-ligne)
 *
 * Supporte : PDF, JPG, PNG, WEBP, TIFF, DOCX, scans, photos téléphone.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OcrResult {
  text:      string
  provider:  'mistral' | 'claude' | 'tesseract' | 'pdf-parse' | 'mammoth'
  confidence?: number  // 0-1
  pages?:    number
  error?:    string
}

export type OcrInput =
  | { type: 'buffer'; data: Buffer; mimeType: string; filename: string }
  | { type: 'url'; url: string; mimeType: string }
  | { type: 'base64'; data: string; mimeType: string }

// ── MIME helpers ───────────────────────────────────────────────────────────────

export function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

export function isPdf(mime: string): boolean {
  return mime === 'application/pdf'
}

export function isDocx(mime: string): boolean {
  return mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mime === 'application/msword'
}

// ── PDF text extraction (no OCR needed if native text) ────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const data = await pdfParse(buffer)
  return data.text?.trim() ?? ''
}

// ── DOCX extraction ────────────────────────────────────────────────────────────

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result  = await mammoth.extractRawText({ buffer })
  return result.value?.trim() ?? ''
}

// ── Mistral Pixtral OCR ────────────────────────────────────────────────────────

async function ocrWithMistral(imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY non configurée')

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          {
            type: 'text',
            text: 'Extrais et retranscris TOUT le texte de ce document exactement tel qu\'il apparaît, en conservant la structure et la mise en page. Ne commente pas, retranscris uniquement le contenu textuel.',
          },
        ],
      }],
      max_tokens: 4096,
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Mistral HTTP ${res.status}`)
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

// ── Claude Vision OCR ──────────────────────────────────────────────────────────

async function ocrWithClaude(imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: 'Extrais et retranscris TOUT le texte de ce document exactement tel qu\'il apparaît. Ne commente pas, retranscris uniquement le contenu textuel.' },
        ],
      }],
    }),
  })

  if (!res.ok) throw new Error(`Claude HTTP ${res.status}`)
  const json = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return json.content?.find(b => b.type === 'text')?.text?.trim() ?? ''
}

// ── Tesseract.js (local fallback) ──────────────────────────────────────────────

async function ocrWithTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const Tesseract = await import('tesseract.js')
  const worker = await Tesseract.createWorker(['fra', 'eng'])
  try {
    const { data } = await worker.recognize(buffer)
    return { text: data.text?.trim() ?? '', confidence: (data.confidence ?? 0) / 100 }
  } finally {
    await worker.terminate()
  }
}

// ── Main OCR function ──────────────────────────────────────────────────────────

export async function extractText(input: OcrInput): Promise<OcrResult> {
  const { mimeType } = input
  let buffer: Buffer

  if (input.type === 'buffer') {
    buffer = input.data
  } else if (input.type === 'base64') {
    buffer = Buffer.from(input.data, 'base64')
  } else {
    const res = await fetch(input.url)
    buffer    = Buffer.from(await res.arrayBuffer())
  }

  // PDF : essayer extraction texte natif d'abord (plus rapide)
  if (isPdf(mimeType)) {
    try {
      const text = await extractPdfText(buffer)
      if (text && text.length > 50) {
        return { text, provider: 'pdf-parse', pages: 1 }
      }
      // PDF scanné → convertir en base64 pour vision IA
    } catch { /* fall through */ }
  }

  // DOCX
  if (isDocx(mimeType)) {
    try {
      const text = await extractDocxText(buffer)
      if (text) return { text, provider: 'mammoth' }
    } catch { /* fall through */ }
  }

  // Images et PDFs scannés → vision IA
  if (isImage(mimeType) || isPdf(mimeType)) {
    const b64 = buffer.toString('base64')
    const imgMime = isPdf(mimeType) ? 'image/jpeg' : mimeType

    // 1. Mistral Pixtral
    try {
      const text = await ocrWithMistral(b64, imgMime)
      if (text) return { text, provider: 'mistral', confidence: 0.95 }
    } catch { /* fall through */ }

    // 2. Claude Vision
    try {
      const text = await ocrWithClaude(b64, imgMime)
      if (text) return { text, provider: 'claude', confidence: 0.9 }
    } catch { /* fall through */ }

    // 3. Tesseract (local)
    try {
      const { text, confidence } = await ocrWithTesseract(buffer)
      return { text, provider: 'tesseract', confidence }
    } catch (err) {
      return { text: '', provider: 'tesseract', error: (err as Error).message }
    }
  }

  // Texte brut
  if (mimeType === 'text/plain') {
    return { text: buffer.toString('utf-8'), provider: 'pdf-parse' }
  }

  return { text: '', provider: 'tesseract', error: `Format non supporté : ${mimeType}` }
}
