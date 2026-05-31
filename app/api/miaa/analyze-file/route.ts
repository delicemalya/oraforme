import Anthropic from '@anthropic-ai/sdk'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'

export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MAX_BASE64_BYTES = 10 * 1024 * 1024 // 10 MB

const SUPPORTED_MEDIA_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

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

    const agent = MIAA_AGENTS[module as MIAAModule]
    if (!agent) return Response.json({ error: 'Module inconnu.' }, { status: 400 })

    // Strip data URL prefix: "data:application/pdf;base64,xxxx" → "xxxx"
    const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    const mediaType = filetype || 'application/pdf'
    const isImage   = filetype.startsWith('image/')
    const isPDF     = filetype === 'application/pdf'

    const systemPrompt = `${agent.personnalite}

Tu es en train d'analyser un document transmis par l'utilisateur.
Module actif : ${module}
Fichier : ${filename} (${Math.round(filesize / 1024)} Ko)

RÈGLES DE FORMATAGE STRICTES :
- Réponds en texte propre, sans astérisques, sans tirets de liste, sans dièse, sans emojis
- Utilise des paragraphes et la numérotation (1. 2. 3.) pour les listes
- Ton style est celui d'un expert-comptable ou conseiller professionnel africain
- Utilise FCFA comme devise
- Identifie les anomalies, risques ou points d'attention

TÂCHE :
Analyse ce document et fournis :
1. Un résumé clair du contenu
2. Les chiffres ou données clés identifiés
3. Les points d'attention ou anomalies détectés
4. Des recommandations concrètes adaptées au contexte africain`

    type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam

    let contentBlocks: ContentBlock[]

    if (isPDF && SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
      contentBlocks = [
        {
          type:   'document',
          source: { type: 'base64', media_type: 'application/pdf', data: rawBase64 },
        } as Anthropic.DocumentBlockParam,
        {
          type: 'text',
          text: `Analyse ce document PDF nommé "${filename}" selon tes instructions.`,
        },
      ]
    } else if (isImage && SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
      contentBlocks = [
        {
          type:   'image',
          source: {
            type:       'base64',
            media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data:       rawBase64,
          },
        } as Anthropic.ImageBlockParam,
        {
          type: 'text',
          text: `Analyse cette image nommée "${filename}" selon tes instructions.`,
        },
      ]
    } else {
      // For Excel/CSV/Word: we can't send binary directly — ask model to guide user
      return Response.json({
        analyse: `Le fichier "${filename}" (${filetype}) a bien été reçu.\n\nPour analyser des fichiers Excel ou Word, copiez-collez le contenu directement dans le chat ou exportez le document en PDF avant de l'envoyer.`,
      })
    }

    const claudeResponse = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const rawText = claudeResponse.content[0].type === 'text'
      ? claudeResponse.content[0].text
      : 'Analyse terminée.'

    return Response.json({ analyse: rawText })
  } catch (err) {
    console.error('[analyze-file]', err)
    return Response.json(
      { error: 'Erreur lors de l\'analyse du fichier.' },
      { status: 500 }
    )
  }
}
