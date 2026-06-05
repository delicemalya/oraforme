import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oraforms.com'

async function sendConfirmationEmail(to: string, prenom: string, titrOffre: string, entreprise: string, candidatureId: string) {
  if (!process.env.RESEND_API_KEY) return
  const trackingUrl = `${APP_URL}/jobs/suivi/${candidatureId}`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${entreprise} via oraforme <noreply@oraforms.com>`,
      to: [to],
      subject: `Votre candidature a bien été reçue — ${titrOffre}`,
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <tr><td style="background:#0F172A;padding:28px 32px">
    <p style="margin:0;color:#F59E0B;font-size:20px;font-weight:800;letter-spacing:-0.5px">oraforme</p>
    <p style="margin:4px 0 0;color:#64748B;font-size:12px">Portail emploi</p>
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A">Bonjour ${prenom} 👋</p>
    <p style="margin:0 0 24px;color:#64748B;font-size:15px;line-height:1.6">
      Votre candidature pour le poste de <strong style="color:#0F172A">${titrOffre}</strong> chez <strong style="color:#0F172A">${entreprise}</strong> a bien été reçue.
    </p>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px">Étapes suivantes</p>
      <p style="margin:0 0 8px;font-size:14px;color:#0F172A">✅ Candidature reçue</p>
      <p style="margin:0 0 8px;font-size:14px;color:#94A3B8">⏳ Analyse de votre profil</p>
      <p style="margin:0 0 8px;font-size:14px;color:#94A3B8">📋 Entretien (si retenu)</p>
      <p style="margin:0;font-size:14px;color:#94A3B8">🏁 Décision finale</p>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${trackingUrl}" style="display:inline-block;background:#F59E0B;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700">
        Suivre ma candidature →
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:16px">
      Cet email a été envoyé automatiquement via oraforme. Ne pas répondre.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
    }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const offreSlug    = formData.get('offreSlug') as string
    const nom          = (formData.get('nom') as string ?? '').trim()
    const prenom       = (formData.get('prenom') as string ?? '').trim()
    const email        = (formData.get('email') as string ?? '').trim().toLowerCase()
    const telephone    = (formData.get('telephone') as string ?? '').trim()
    const message      = (formData.get('message') as string ?? '').trim()
    const cvFile       = formData.get('cv') as File | null

    if (!offreSlug || !nom || !prenom || !email) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 })
    }

    // Fetch offer
    const { data: offre } = await supabaseAdmin
      .from('offres_emploi')
      .select('id, tenant_id, titre, statut')
      .eq('slug', offreSlug)
      .maybeSingle()

    if (!offre) return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 })
    if (offre.statut !== 'active') return NextResponse.json({ error: 'Cette offre n\'est plus disponible.' }, { status: 410 })

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('nom')
      .eq('id', offre.tenant_id)
      .maybeSingle()

    const entrepriseNom = tenant?.nom ?? 'Entreprise'

    // Upload CV to Supabase Storage
    let cvUrl: string | null = null
    if (cvFile && cvFile.size > 0) {
      const ext = cvFile.name.split('.').pop()?.toLowerCase() ?? 'pdf'
      const safeName = `${nom}-${prenom}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const filename = `${offre.tenant_id}/${Date.now()}-${safeName}.${ext}`
      const buffer = Buffer.from(await cvFile.arrayBuffer())

      const { data: upload, error: uploadErr } = await supabaseAdmin.storage
        .from('cvs-candidats')
        .upload(filename, buffer, { contentType: cvFile.type || 'application/octet-stream', upsert: false })

      if (!uploadErr && upload) {
        const { data: urlData } = supabaseAdmin.storage.from('cvs-candidats').getPublicUrl(upload.path)
        cvUrl = urlData.publicUrl
      }
    }

    // Duplicate detection: check if candidat with same email OR phone exists for this tenant
    const { data: existingByEmail } = await supabaseAdmin
      .from('candidats')
      .select('id')
      .eq('tenant_id', offre.tenant_id)
      .eq('email', email)
      .maybeSingle()

    const { data: existingByPhone } = telephone
      ? await supabaseAdmin.from('candidats').select('id').eq('tenant_id', offre.tenant_id).eq('telephone', telephone).maybeSingle()
      : { data: null }

    const existingCandidat = existingByEmail ?? existingByPhone
    const estDoublon = !!existingCandidat

    let candidatId: string

    if (existingCandidat) {
      candidatId = existingCandidat.id
      // Update CV url if new one uploaded
      if (cvUrl) {
        await supabaseAdmin.from('candidats').update({ cv_url: cvUrl }).eq('id', candidatId)
      }
    } else {
      const { data: newCandidat, error: candidatErr } = await supabaseAdmin
        .from('candidats')
        .insert({
          tenant_id: offre.tenant_id,
          nom,
          prenom,
          email,
          telephone: telephone || null,
          cv_url: cvUrl,
          statut: 'nouveau',
        })
        .select('id')
        .single()

      if (candidatErr || !newCandidat) {
        return NextResponse.json({ error: 'Erreur création candidat.' }, { status: 500 })
      }
      candidatId = newCandidat.id
    }

    // Check if already applied to this specific offer
    const { data: existingCandidature } = await supabaseAdmin
      .from('candidatures')
      .select('id, statut')
      .eq('offre_id', offre.id)
      .eq('candidat_id', candidatId)
      .maybeSingle()

    if (existingCandidature) {
      return NextResponse.json({
        success: false,
        doublon: true,
        message: 'Vous avez déjà postulé pour cette offre.',
        id: existingCandidature.id,
      })
    }

    // Create candidature
    const { data: candidature, error: candErr } = await supabaseAdmin
      .from('candidatures')
      .insert({
        tenant_id: offre.tenant_id,
        offre_id: offre.id,
        candidat_id: candidatId,
        statut: 'recu',
        est_doublon: estDoublon,
        rapport_ia: message ? { message_candidat: message } : null,
      })
      .select('id')
      .single()

    if (candErr || !candidature) {
      return NextResponse.json({ error: 'Erreur enregistrement candidature.' }, { status: 500 })
    }

    // Confirmation email (non-blocking)
    sendConfirmationEmail(email, prenom, offre.titre, entrepriseNom, candidature.id)

    return NextResponse.json({ success: true, id: candidature.id, doublon: estDoublon })
  } catch (err) {
    console.error('[api/jobs/candidature]', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
