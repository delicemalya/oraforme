export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { BulletinPDF, type BulletinPDFData, type BulletinNote } from '@/components/ecole/BulletinPDF'

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const bulletinId = searchParams.get('id')
  if (!bulletinId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { data: bulletin } = await supabaseAdmin
    .from('bulletins_notes')
    .select(`
      *,
      etudiants(nom, prenom, numero_etudiant, classes_ecole(nom, niveau)),
      notes_bulletin(matiere, note, note_max, coefficient, commentaire)
    `)
    .eq('id', bulletinId)
    .eq('tenant_id', callerProfile.tenant_id)
    .maybeSingle()

  if (!bulletin) return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })

  const [{ data: config }, { data: tenant }] = await Promise.all([
    supabaseAdmin.from('entreprise_config').select('*')
      .eq('tenant_id', callerProfile.tenant_id)
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from('tenants').select('nom_entreprise')
      .eq('id', callerProfile.tenant_id).maybeSingle(),
  ])

  const etudiant = bulletin.etudiants as {
    nom: string; prenom: string; numero_etudiant?: string
    classes_ecole?: { nom: string; niveau: string }
  } | null

  const notes: BulletinNote[] = (bulletin.notes_bulletin ?? []).map((n: {
    matiere: string; note: number; note_max: number; coefficient: number; commentaire?: string
  }) => ({
    matiere:      n.matiere,
    note:         n.note,
    note_max:     n.note_max ?? 20,
    coefficient:  n.coefficient ?? 1,
    commentaire:  n.commentaire,
  }))

  const data: BulletinPDFData = {
    nom_ecole:            config?.nom ?? tenant?.nom_entreprise ?? 'École',
    logo_url:             config?.logo_url ?? null,
    adresse_ecole:        config?.adresse ?? undefined,
    telephone_ecole:      config?.telephone ?? undefined,
    annee_scolaire:       bulletin.annee_scolaire ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    periode:              bulletin.periode ?? 'Trimestre 1',
    nom_etudiant:         etudiant?.nom ?? '',
    prenom_etudiant:      etudiant?.prenom ?? '',
    numero_id:            etudiant?.numero_etudiant ?? bulletinId.slice(0, 8).toUpperCase(),
    classe:               etudiant?.classes_ecole?.nom ?? bulletin.classe ?? '',
    niveau:               etudiant?.classes_ecole?.niveau ?? '',
    notes,
    moyenne_generale:     bulletin.moyenne_generale ?? 0,
    rang:                 bulletin.rang ?? undefined,
    effectif_classe:      bulletin.effectif_classe ?? undefined,
    appreciation:         bulletin.appreciation ?? undefined,
    mention:              bulletin.mention ?? undefined,
    directeur:            bulletin.directeur ?? undefined,
    professeur_principal: bulletin.professeur_principal ?? undefined,
  }

  try {
    const buffer = await renderToBuffer(
      createElement(BulletinPDF, { data }) as ReactElement<DocumentProps>
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="bulletin-${data.nom_etudiant}-${data.periode}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Bulletin scolaire PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}