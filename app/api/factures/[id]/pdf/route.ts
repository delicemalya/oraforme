import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { FacturePDF } from '@/components/facture/FacturePDF'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate and verify tenant ownership
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params

  // Verify invoice belongs to caller's tenant before generating PDF
  const { data: factureOwner } = await supabaseAdmin
    .from('factures').select('tenant_id').eq('id', id).maybeSingle()
  if (!factureOwner || factureOwner.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  const [{ data: facture }, { data: lignes }, { data: config }] = await Promise.all([
    supabaseAdmin.from('factures').select('*').eq('id', id).single(),
    supabaseAdmin.from('facture_lignes').select('*').eq('invoice_id', id).order('id'),
    supabaseAdmin
      .from('entreprise_config')
      .select('*')
      .eq('tenant_id', (
        await supabaseAdmin.from('factures').select('tenant_id').eq('id', id).single()
      ).data?.tenant_id ?? '')
      .maybeSingle(),
  ])

  if (!facture) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  // QR code pour vérification authenticité
  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oraforms.com'}/verify/invoice/${id}`
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
  } catch { /* QR optionnel */ }

  const factureData = {
    invoice_number: facture.invoice_number ?? facture.id.slice(0, 8).toUpperCase(),
    client_name:    facture.client_name ?? facture.client_nom ?? 'Client',
    client_address: facture.client_address ?? null,
    client_phone:   facture.client_phone ?? null,
    client_email:   facture.client_email ?? null,
    date:           facture.date ?? facture.created_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    due_date:       facture.due_date ?? null,
    subtotal:       facture.subtotal ?? facture.montant_ht ?? 0,
    notes:          facture.notes ?? null,
    statut:         facture.statut ?? 'brouillon',
    qr_data_url:    qrDataUrl,
    lignes: (lignes ?? []).length > 0
      ? (lignes ?? [])
      : (facture.items ?? []).map((it: { description: string; prix_unitaire: number; quantite: number }) => ({
          description: it.description,
          price:       it.prix_unitaire,
          quantity:    it.quantite,
          total:       it.prix_unitaire * it.quantite,
        })),
  }

  const configData = {
    nom:           config?.nom ?? null,
    logo_url:      config?.logo_url ?? null,
    adresse:       config?.adresse ?? null,
    telephone:     config?.telephone ?? null,
    email:         config?.email ?? null,
    ville:         config?.ville ?? 'Pointe-Noire',
    pays:          config?.pays ?? 'Congo-Brazzaville',
    rccm:          config?.rccm ?? null,
    sciet:         config?.sciet ?? null,
    scien:         config?.scien ?? null,
    capital:       config?.capital ?? null,
    rib:           config?.rib ?? null,
    message_defaut:config?.message_defaut ?? 'Merci pour votre confiance.',
  }

  try {
    const buffer = await renderToBuffer(
      createElement(FacturePDF, { facture: factureData, config: configData }) as ReactElement<DocumentProps>
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${factureData.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}
