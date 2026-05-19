import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oraforms.com'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
    if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })

    const { data: facture, error: fetchErr } = await supabaseAdmin
      .from('factures')
      .select('id, invoice_number, client_email, client_name, tenant_id, statut, total, montant_ht, tva')
      .eq('id', id)
      .eq('tenant_id', callerProfile.tenant_id)
      .single()

    if (fetchErr || !facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('nom').eq('id', callerProfile.tenant_id).maybeSingle()

    const tenantName = tenant?.nom ?? 'oraforme'
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'

    let emailSent = false
    let emailError: string | null = null

    if (process.env.RESEND_API_KEY && facture.client_email) {
      const pdfUrl = `${APP_URL}/api/factures/${id}/pdf`

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${tenantName} <noreply@oraforms.com>`,
          to: [facture.client_email],
          subject: `Facture ${facture.invoice_number} — ${tenantName}`,
          html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:#142850;padding:24px 32px">
      <h1 style="color:#F08900;margin:0;font-size:20px">${tenantName}</h1>
      <p style="color:#8B949E;margin:4px 0 0;font-size:13px">Facture électronique</p>
    </div>
    <div style="padding:32px">
      <p style="color:#333;font-size:15px">Cher(e) <strong>${facture.client_name ?? 'Client'}</strong>,</p>
      <p style="color:#555;font-size:14px;line-height:1.6">
        Veuillez trouver ci-dessous votre facture <strong>${facture.invoice_number}</strong>.
      </p>
      <div style="background:#f8f8f8;border-radius:6px;padding:20px;margin:24px 0">
        <table style="width:100%;font-size:14px">
          <tr><td style="color:#666;padding:6px 0">Numéro</td><td style="text-align:right;font-weight:bold">${facture.invoice_number}</td></tr>
          <tr><td style="color:#666;padding:6px 0">Montant HT</td><td style="text-align:right">${fmt(facture.montant_ht ?? 0)}</td></tr>
          <tr><td style="color:#666;padding:6px 0">TVA</td><td style="text-align:right">${fmt(facture.tva ?? 0)}</td></tr>
          <tr style="border-top:2px solid #ddd"><td style="color:#333;padding:10px 0 0;font-weight:bold;font-size:16px">TOTAL TTC</td><td style="text-align:right;font-weight:bold;font-size:16px;color:#F08900;padding-top:10px">${fmt(facture.total ?? 0)}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${pdfUrl}" style="display:inline-block;padding:14px 32px;background:#F08900;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px">
          📄 Télécharger la facture PDF
        </a>
      </div>
      <p style="color:#888;font-size:12px;text-align:center">
        Ce message a été envoyé automatiquement par ${tenantName} via oraforme.
      </p>
    </div>
  </div>
</body>
</html>`,
        }),
      })

      emailSent = emailRes.ok
      if (!emailRes.ok) {
        const errBody = await emailRes.json().catch(() => ({}))
        emailError = (errBody as { message?: string }).message ?? `HTTP ${emailRes.status}`
        console.error('Resend error:', emailError)
      }
    }

    await supabaseAdmin
      .from('factures')
      .update({ statut: 'envoyee' })
      .eq('id', id)
      .eq('tenant_id', callerProfile.tenant_id)

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Facture ${facture.invoice_number} envoyée par email à ${facture.client_email}`
        : process.env.RESEND_API_KEY
          ? `Email non envoyé (${emailError}), facture marquée comme envoyée`
          : `Facture ${facture.invoice_number} marquée comme envoyée (configurer RESEND_API_KEY pour l'envoi réel)`,
      sent_to: facture.client_email ?? null,
      email_sent: emailSent,
    })
  } catch (err) {
    console.error('Send invoice error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
