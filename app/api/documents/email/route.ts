import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

// POST /api/documents/email
// Body: { type: 'bulletin' | 'attestation' | 'bulletin_paie', id: string, to?: string }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { type, id, to } = body as { type?: string; id?: string; to?: string }

    if (!type || !id) return NextResponse.json({ error: 'type et id requis' }, { status: 400 })

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('nom').eq('id', profile.tenant_id).maybeSingle()
    const tenantName = tenant?.nom ?? 'oraforme'

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oraforms.com'

    let recipientEmail: string | null = to ?? null
    let subject = ''
    let htmlBody = ''
    let pdfUrl = ''
    let docLabel = ''

    if (type === 'bulletin') {
      // Bulletin de notes étudiant
      const { data: etudiant } = await supabaseAdmin
        .from('etudiants').select('prenom,nom,email,email_parent,annee_scolaire').eq('id', id).eq('tenant_id', profile.tenant_id).maybeSingle()
      if (!etudiant) return NextResponse.json({ error: 'Étudiant introuvable' }, { status: 404 })

      recipientEmail = recipientEmail ?? etudiant.email ?? etudiant.email_parent ?? null
      if (!recipientEmail) return NextResponse.json({ error: 'Aucun email trouvé pour cet étudiant' }, { status: 400 })

      pdfUrl = `${APP_URL}/api/documents/bulletin?etudiant_id=${id}`
      docLabel = 'Bulletin de notes'
      subject = `Bulletin de notes — ${etudiant.prenom} ${etudiant.nom} · ${etudiant.annee_scolaire ?? ''}`
      htmlBody = buildEmailHtml({
        tenantName,
        recipientName: `${etudiant.prenom} ${etudiant.nom}`,
        docLabel,
        pdfUrl,
        message: `Veuillez trouver ci-joint le bulletin de notes de <strong>${etudiant.prenom} ${etudiant.nom}</strong> pour l'année scolaire ${etudiant.annee_scolaire ?? ''}.`,
      })
    } else if (type === 'attestation') {
      const { data: etudiant } = await supabaseAdmin
        .from('etudiants').select('prenom,nom,email,email_parent,annee_scolaire').eq('id', id).eq('tenant_id', profile.tenant_id).maybeSingle()
      if (!etudiant) return NextResponse.json({ error: 'Étudiant introuvable' }, { status: 404 })

      recipientEmail = recipientEmail ?? etudiant.email ?? etudiant.email_parent ?? null
      if (!recipientEmail) return NextResponse.json({ error: 'Aucun email trouvé pour cet étudiant' }, { status: 400 })

      pdfUrl = `${APP_URL}/api/documents/attestation?etudiant_id=${id}`
      docLabel = "Attestation d'inscription"
      subject = `Attestation d'inscription — ${etudiant.prenom} ${etudiant.nom}`
      htmlBody = buildEmailHtml({
        tenantName,
        recipientName: `${etudiant.prenom} ${etudiant.nom}`,
        docLabel,
        pdfUrl,
        message: `Veuillez trouver ci-joint votre attestation d'inscription délivrée par <strong>${tenantName}</strong>.`,
      })
    } else if (type === 'bulletin_paie') {
      // Bulletin de paie employé
      const { data: bulletin } = await supabaseAdmin
        .from('bulletins_paie')
        .select('net, periode_mois, employe_id, employes(prenom, nom, email)')
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle()
      if (!bulletin) return NextResponse.json({ error: 'Bulletin de paie introuvable' }, { status: 404 })

      const emp = (Array.isArray(bulletin.employes) ? bulletin.employes[0] : bulletin.employes) as { prenom: string; nom: string; email: string | null } | null
      recipientEmail = recipientEmail ?? emp?.email ?? null
      if (!recipientEmail) return NextResponse.json({ error: "Aucun email trouvé pour l'employé" }, { status: 400 })

      pdfUrl = `${APP_URL}/api/hr/payslips/${id}/pdf`
      docLabel = 'Bulletin de paie'
      subject = `Bulletin de paie — ${bulletin.periode_mois ?? ''}`
      htmlBody = buildEmailHtml({
        tenantName,
        recipientName: emp ? `${emp.prenom} ${emp.nom}` : 'Employé',
        docLabel,
        pdfUrl,
        message: `Veuillez trouver ci-joint votre bulletin de paie pour la période <strong>${bulletin.periode_mois ?? ''}</strong>. Montant net : <strong>${new Intl.NumberFormat('fr-FR').format(bulletin.net)} FCFA</strong>.`,
      })
    } else {
      return NextResponse.json({ error: `Type de document inconnu : ${type}` }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        email_sent: false,
        message: 'RESEND_API_KEY non configurée — ajoutez-la dans Vercel → Settings → Environment Variables',
      })
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${tenantName} <noreply@oraforms.com>`,
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}))
      const msg = (errBody as { message?: string }).message ?? `HTTP ${emailRes.status}`
      console.error('Resend error:', msg)
      return NextResponse.json({ success: false, email_sent: false, message: `Erreur envoi email : ${msg}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email_sent: true,
      sent_to: recipientEmail,
      message: `${docLabel} envoyé à ${recipientEmail}`,
    })
  } catch (err) {
    console.error('Document email error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function buildEmailHtml({ tenantName, recipientName, docLabel, pdfUrl, message }: {
  tenantName: string
  recipientName: string
  docLabel: string
  pdfUrl: string
  message: string
}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:#0D1117;padding:24px 32px">
      <h1 style="color:#F0A30A;margin:0;font-size:20px">${tenantName}</h1>
      <p style="color:#8B949E;margin:4px 0 0;font-size:13px">${docLabel}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#333;font-size:15px">Cher(e) <strong>${recipientName}</strong>,</p>
      <p style="color:#555;font-size:14px;line-height:1.6">${message}</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${pdfUrl}" style="display:inline-block;padding:14px 32px;background:#F0A30A;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px">
          📄 Télécharger ${docLabel}
        </a>
      </div>
      <p style="color:#888;font-size:12px;text-align:center">
        Ce message a été envoyé automatiquement par ${tenantName} via oraforme.
      </p>
    </div>
  </div>
</body>
</html>`
}
