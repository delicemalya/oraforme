import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    let text = ''

    if (name.endsWith('.pdf')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const result = await pdfParse(buffer)
      text = result.text
    } else if (name.endsWith('.docx')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (name.endsWith('.txt')) {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez PDF, DOCX ou TXT.' },
        { status: 400 }
      )
    }

    // Truncate to avoid Claude token limit
    const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 8000)
    return NextResponse.json({ text: trimmed, filename: file.name, chars: trimmed.length })
  } catch (err) {
    console.error('[api/cv/upload]', err)
    return NextResponse.json({ error: "Erreur lors de l'extraction du texte." }, { status: 500 })
  }
}
