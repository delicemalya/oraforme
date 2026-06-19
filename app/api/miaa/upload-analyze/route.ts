import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'
import { EXPERTS } from '@/lib/miaa/experts'

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const mistral    = process.env.MISTRAL_API_KEY
  ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  : null

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null
    const question = (formData.get('question') as string) || 'Analyse ce document et donne-moi les points importants.'
    const moduleKey = (formData.get('module') as string) || 'general'

    if (!file) return Response.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })

    const mime   = file.type
    const buffer = Buffer.from(await file.arrayBuffer())
    const expert = EXPERTS[moduleKey] ?? EXPERTS.general

    // ── Images : Mistral Pixtral OCR ou Claude Vision ──────────────────────────
    if (mime.startsWith('image/')) {
      return analyzeImage(buffer, mime, question, expert)
    }

    // ── PDF : extraction texte via parsing basique ─────────────────────────────
    if (mime === 'application/pdf') {
      return analyzePDF(buffer, question, expert, file.name)
    }

    // ── Excel : analyse CSV-like ───────────────────────────────────────────────
    if (mime.includes('spreadsheet') || mime.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      return analyzeSpreadsheet(buffer, mime, question, expert, file.name)
    }

    // ── Word / TXT ─────────────────────────────────────────────────────────────
    if (mime.includes('word') || mime === 'text/plain' || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      return analyzeText(buffer, question, expert, file.name)
    }

    return Response.json({ error: 'Format non supporté. Formats acceptés : PDF, Excel, Word, image (JPG, PNG), CSV, TXT.' }, { status: 400 })

  } catch (err) {
    console.error('[MIAA upload-analyze]', err)
    return Response.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 })
  }
}

async function analyzeImage(buffer: Buffer, mime: string, question: string, expert: string) {
  // Essayer Mistral Pixtral d'abord (meilleur OCR)
  if (mistral) {
    try {
      const base64 = buffer.toString('base64')
      const res = await mistral.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${expert.slice(0, 500)}\n\nQuestion : ${question}\n\nAnalyse cette image et réponds en français. Si c'est un document financier/RH, extrais toutes les données chiffrées.` },
            { type: 'image_url', imageUrl: { url: `data:${mime};base64,${base64}` } },
          ],
        }],
      })
      const content = (res.choices?.[0]?.message?.content ?? '') as string
      return Response.json({ analysis: content, model: 'pixtral-ocr', type: 'image' })
    } catch { /* fallback to Claude */ }
  }

  // Fallback : Claude Vision
  const base64 = buffer.toString('base64')
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: base64 } },
        { type: 'text', text: `${expert.slice(0, 500)}\n\nQuestion : ${question}\n\nAnalyse ce document en détail. Extrais toutes les données importantes.` },
      ],
    }],
  })
  const content = res.content[0].type === 'text' ? res.content[0].text : ''
  return Response.json({ analysis: content, model: 'claude-vision', type: 'image' })
}

async function analyzePDF(buffer: Buffer, question: string, expert: string, filename: string) {
  let extractedText = ''
  try {
    const pdfParse = (await import('pdf-parse') as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default
    const result = await pdfParse(buffer)
    extractedText = result.text?.trim().slice(0, 6000) ?? ''
  } catch { /* PDF scanné ou corrompu — pas de texte natif */ }

  const prompt = `${expert.slice(0, 600)}\n\nFichier : ${filename}\n\nContenu extrait :\n${extractedText || 'Impossible d\'extraire le texte — le PDF est peut-être scanné (image).'}\n\nQuestion : ${question}\n\nAnalyse ce document et réponds en français. Si c'est un bulletin de paie, vérifie les calculs CNSS/IRPP.`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })
  const content = res.content[0].type === 'text' ? res.content[0].text : ''
  return Response.json({ analysis: content, model: 'claude-sonnet', type: 'pdf', chars_extracted: extractedText.length })
}

async function analyzeSpreadsheet(buffer: Buffer, mime: string, question: string, expert: string, filename: string) {
  let csvText = ''

  if (mime === 'text/csv' || filename.endsWith('.csv')) {
    csvText = buffer.toString('utf-8').slice(0, 8000)
  } else {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const rows: string[] = []
      for (const sheetName of wb.SheetNames.slice(0, 3)) {
        const ws = wb.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        rows.push(`=== ${sheetName} ===`)
        rows.push(...data.slice(0, 200).map(row => Object.values(row).join('\t')))
      }
      csvText = rows.join('\n').slice(0, 8000)
    } catch {
      csvText = 'Impossible d\'extraire le contenu Excel.'
    }
  }

  const prompt = `${expert.slice(0, 600)}\n\nFichier : ${filename}\n\nDonnées :\n${csvText}\n\nQuestion : ${question}\n\nAnalyse ces données en détail. Calcule les totaux si nécessaire. Détecte les anomalies.`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })
  const content = res.content[0].type === 'text' ? res.content[0].text : ''
  return Response.json({ analysis: content, model: 'claude-sonnet', type: 'spreadsheet' })
}

async function analyzeText(buffer: Buffer, question: string, expert: string, filename: string) {
  const text = buffer.toString('utf-8').slice(0, 8000)
  const prompt = `${expert.slice(0, 600)}\n\nFichier : ${filename}\n\nContenu :\n${text}\n\nQuestion : ${question}`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })
  const content = res.content[0].type === 'text' ? res.content[0].text : ''
  return Response.json({ analysis: content, model: 'claude-haiku', type: 'text' })
}
