import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { AttestationPDF, type AttestationPDFData, type AttestationType } from '@/components/ecole/AttestationPDF'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const attestationId = searchParams.get('id')
  if (!attestationId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  // Fetch attestation + student + tenant
  const { data: attest } = await supabaseAdmin
    .from('attestations')
    .select('*, etudiants(nom, prenom, date_naissance, nationalite, numero_etudiant, classes_ecole(nom, niveau))')
    .eq('id', attestationId)
    .eq('tenant_id', callerProfile.tenant_id)
    .maybeSingle()

  if (!attest) return NextResponse.json({ error: 'Attestation introuvable' }, { status: 404 })

  const { data: config } = await supabaseAdmin
    .from('entreprise_config')
    .select('*')
    .eq('tenant_id', callerProfile.tenant_id)
    .maybeSingle()

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise')
    .eq('id', callerProfile.tenant_id)
    .maybeSingle()

  const etudiant = attest.etudiants as {
    nom: string; prenom: string; date_naissance?: string; nationalite?: string
    numero_etudiant?: string; classes_ecole?: { nom: string; niveau: string }
  } | null

  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oraforms.com'}/verify/attestation/${attestationId}`
  let qrDataUrl: string | undefined
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120, margin: 1 })
  } catch { /* QR optional */ }

  const data: AttestationPDFData = {
    nom_ecole:          config?.nom ?? tenant?.nom_entreprise ?? 'École',
    logo_url:           config?.logo_url ?? undefined,
    adresse_ecole:      config?.adresse ?? undefined,
    telephone_ecole:    config?.telephone ?? undefined,
    email_ecole:        config?.email ?? undefined,
    nom:                etudiant?.nom ?? '',
    prenom:             etudiant?.prenom ?? '',
    date_naissance:     etudiant?.date_naissance ?? undefined,
    nationalite:        etudiant?.nationalite ?? 'Congolaise',
    numero_etudiant:    etudiant?.numero_etudiant ?? attest.etudiant_id?.slice(0, 8).toUpperCase() ?? '',
    classe:             etudiant?.classes_ecole?.nom ?? '',
    niveau:             etudiant?.classes_ecole?.niveau ?? '',
    type:               (attest.type_attestation ?? 'inscription') as AttestationType,
    annee_academique:   attest.annee_academique ?? new Date().getFullYear().toString(),
    date_delivrance:    attest.created_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    numero_attestation: attest.numero ?? attestationId.slice(0, 8).toUpperCase(),
    directeur:          attest.directeur ?? undefined,
    qr_data_url:        qrDataUrl,
  }

  try {
    const buffer = await renderToBuffer(
      createElement(AttestationPDF, { data }) as ReactElement<DocumentProps>
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="attestation-${data.numero_attestation}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Attestation PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}
