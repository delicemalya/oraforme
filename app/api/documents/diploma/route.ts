export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { DiplomaePDF, type DiplomaePDFData } from '@/components/ecole/DiplomaePDF'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  // Authenticate
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const diplomaId = searchParams.get('id')
  if (!diplomaId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  // Fetch diploma + student + tenant
  const { data: diploma } = await supabaseAdmin
    .from('diplomas')
    .select('*, etudiants(nom, prenom, date_naissance, nationalite, numero_etudiant, classes_ecole(nom, niveau))')
    .eq('id', diplomaId)
    .eq('tenant_id', callerProfile.tenant_id)
    .maybeSingle()

  if (!diploma) return NextResponse.json({ error: 'Diplôme introuvable' }, { status: 404 })

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise')
    .eq('id', callerProfile.tenant_id)
    .maybeSingle()

  const etudiant = diploma.etudiants as {
    nom: string; prenom: string; date_naissance?: string; nationalite?: string
    numero_etudiant?: string; classes_ecole?: { nom: string; niveau: string }
  } | null

  // Generate QR code for verification
  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oraforms.com'}/verify/diploma/${diplomaId}`
  let qrDataUrl: string | undefined
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120, margin: 1 })
  } catch { /* QR optional */ }

  const data: DiplomaePDFData = {
    nom_ecole:       tenant?.nom_entreprise ?? 'École',
    nom:             etudiant?.nom ?? '',
    prenom:          etudiant?.prenom ?? '',
    date_naissance:  etudiant?.date_naissance ?? undefined,
    nationalite:     etudiant?.nationalite ?? 'Congolaise',
    intitule_diplome: diploma.intitule ?? 'Licence',
    mention:         diploma.mention ?? 'Bien',
    moyenne:         diploma.moyenne ?? undefined,
    annee_academique: diploma.annee_academique ?? new Date().getFullYear().toString(),
    date_delivrance: diploma.date_delivrance ?? new Date().toISOString().split('T')[0],
    numero_diplome:  diploma.numero_diplome ?? diplomaId.slice(0, 8).toUpperCase(),
    directeur:       diploma.directeur ?? undefined,
    jury_president:  diploma.jury_president ?? undefined,
    qr_data_url:     qrDataUrl,
    verification_url: verificationUrl,
  }

  try {
    const buffer = await renderToBuffer(
      createElement(DiplomaePDF, { data }) as ReactElement<DocumentProps>
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="diplome-${data.numero_diplome}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Diploma PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}