import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { getMIAASystemPrompt } from '@/lib/miaa/system-prompt'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const MAX_BASE64_BYTES = 10 * 1024 * 1024

const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function detectType(filetype: string, filename: string) {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const isExcel  = filetype.includes('spreadsheet') || filetype.includes('excel') ||
    ['xlsx', 'xls'].includes(ext)
  const isCsv    = filetype.includes('csv') || ext === 'csv'
  const isWord   = filetype.includes('word') || ['docx', 'doc'].includes(ext)
  const isPDF    = filetype === 'application/pdf' || ext === 'pdf'
  const isImage  = SUPPORTED_IMAGE_TYPES.includes(filetype)
  const isText   = filetype.startsWith('text/') || ext === 'txt'
  return { isExcel, isCsv, isWord, isPDF, isImage, isText }
}

async function extraireExcel(buffer: Buffer, filename: string): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  let contenu = `FICHIER EXCEL : ${filename}\n`
  contenu += `Feuilles : ${workbook.SheetNames.join(', ')}\n\n`

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1, defval: '', raw: false,
    })
    contenu += `=== Feuille "${sheetName}" ===\n`
    for (const row of rows) {
      const cells = (row as string[]).map(c => String(c ?? '').trim())
      if (cells.some(c => c !== '')) {
        contenu += cells.join(' | ') + '\n'
      }
    }
    contenu += '\n'
  }
  return contenu
}

async function extraireWord(buffer: Buffer, filename: string): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return `FICHIER WORD : ${filename}\n\n${result.value}`
}

export async function POST(req: Request) {
  try {
    const { module, filename, filetype, filesize, base64, tenantData } = await req.json() as {
      module:     string
      filename:   string
      filetype:   string
      filesize:   number
      base64:     string
      tenantData?: { tenant_id?: string }
    }

    if (!base64 || base64.length > MAX_BASE64_BYTES * 1.4) {
      return Response.json({ error: 'Fichier trop volumineux ou invalide.' }, { status: 400 })
    }

    // Charger mémoire + contexte entreprise
    const tenantId = tenantData?.tenant_id
    let memory = null
    if (tenantId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      memory = await chargerMemoireMIAA(supabase, tenantId)
    }

    const agent = MIAA_AGENTS[module as MIAAModule]

    const systemPrompt = memory
      ? getMIAASystemPrompt({ memory, module_actuel: module, langue: 'fr', agent_context: agent?.personnalite })
      : `${agent?.personnalite ?? ''}

RÈGLES DE FORMATAGE : texte propre, sans astérisques, sans markdown. Numérotation 1. 2. 3. pour les listes.
Tu es un expert en gestion d'entreprise africaine. Analyse ce document avec précision.
CALCUL TVA CONGO : HT × 18% = TVA, puis TVA × 5% = Centime Additionnel, TTC = HT + TVA + CA.`

    // Strip data URL prefix
    const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    const buffer    = Buffer.from(rawBase64, 'base64')
    const { isExcel, isCsv, isWord, isPDF, isImage, isText } = detectType(filetype, filename)

    // ── EXCEL / XLS ────────────────────────────────────────────────────────────
    if (isExcel) {
      const contenu = await extraireExcel(buffer, filename)
      const truncated = contenu.slice(0, 60000) // Claude max ~100k chars

      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: `Voici le contenu exact du fichier Excel "${filename}" (${Math.round(filesize / 1024)} Ko) :\n\n${truncated}\n\nAnalyse ces données en détail : identifie les colonnes, calcule les totaux si pertinent, détecte les anomalies, et donne tes recommandations.`,
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    // ── CSV ────────────────────────────────────────────────────────────────────
    if (isCsv) {
      const text = buffer.toString('utf-8')
      const contenu = `FICHIER CSV : ${filename}\n\n${text.slice(0, 60000)}`
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: `Contenu du fichier CSV "${filename}" :\n\n${contenu}\n\nAnalyse ces données.`,
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    // ── WORD / DOCX ────────────────────────────────────────────────────────────
    if (isWord) {
      const contenu = await extraireWord(buffer, filename)
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: `Voici le contenu du fichier Word "${filename}" :\n\n${contenu.slice(0, 60000)}\n\nAnalyse ce document.`,
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    // ── TEXTE ──────────────────────────────────────────────────────────────────
    if (isText) {
      const text = buffer.toString('utf-8')
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: `Contenu du fichier "${filename}" :\n\n${text.slice(0, 60000)}\n\nAnalyse ce document.`,
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    // ── PDF — via API native Claude (document block) ───────────────────────────
    if (isPDF) {
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: rawBase64 } } as Anthropic.DocumentBlockParam,
            { type: 'text', text: `Analyse ce document PDF "${filename}" en détail : résumé, données clés, anomalies, recommandations.` },
          ],
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    // ── IMAGE — via vision Claude ──────────────────────────────────────────────
    if (isImage) {
      const mt = filetype as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
      const response = await anthropic.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mt, data: rawBase64 } } as Anthropic.ImageBlockParam,
            { type: 'text', text: `Analyse cette image "${filename}". S'il s'agit d'un bulletin de paie, facture ou document comptable, extrais toutes les données chiffrées et vérifie les calculs.` },
          ],
        }],
      })
      return Response.json({ analyse: response.content[0].type === 'text' ? response.content[0].text : 'Analyse terminée.' })
    }

    return Response.json({
      analyse: `Format non supporté : ${filetype}.\nFormats acceptés : Excel (.xlsx, .xls), CSV, Word (.docx), PDF, images (PNG, JPG), texte (.txt).`,
    })

  } catch (err) {
    console.error('[analyze-file]', err)
    return Response.json({ error: 'Erreur lors de l\'analyse du fichier.' }, { status: 500 })
  }
}
