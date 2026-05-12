import { NextRequest, NextResponse } from 'next/server'

/**
 * Webhook email pour recevoir des CVs par email.
 * Compatible avec SendGrid Inbound Parse.
 *
 * Setup SendGrid :
 * 1. Configurer le domaine MX dans votre DNS
 * 2. Dashboard SendGrid → Mail Settings → Inbound Parse
 * 3. URL : https://votre-domaine.com/api/cv/email
 * 4. Le service envoie un POST multipart/form-data avec les pièces jointes
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const from    = formData.get('from')    as string ?? ''
    const subject = formData.get('subject') as string ?? ''

    // Compter les pièces jointes
    const attachments: { filename: string; content: string }[] = []
    let i = 0
    while (formData.get(`attachment${i + 1}`)) {
      const att = formData.get(`attachment${i + 1}`) as File
      if (att && (att.name.endsWith('.pdf') || att.name.endsWith('.docx'))) {
        attachments.push({ filename: att.name, content: '' })
      }
      i++
    }

    if (attachments.length === 0) {
      return NextResponse.json(
        { message: 'Email reçu mais aucune pièce jointe PDF/DOCX trouvée.' },
        { status: 200 }
      )
    }

    // TODO: Pour chaque pièce jointe :
    // 1. Appeler /api/cv/upload pour extraire le texte
    // 2. Appeler /api/cv/analyze pour analyser le CV
    // 3. Notifier le recruteur par email

    console.log(`[cv/email] Email de ${from}, sujet: "${subject}", ${attachments.length} CV(s)`)

    return NextResponse.json({
      message: `${attachments.length} CV(s) reçus et en cours d'analyse.`,
      from, subject, count: attachments.length,
    })
  } catch (err) {
    console.error('[cv/email]', err)
    return NextResponse.json({ error: 'Erreur webhook email.' }, { status: 500 })
  }
}
