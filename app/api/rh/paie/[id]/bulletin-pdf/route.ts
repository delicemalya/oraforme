export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../../hr/_auth'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { PayslipPDF } from '@/components/rh/PayslipPDF'

const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const { data: bulletin, error: bulletinErr } = await supabaseAdmin
    .from('bulletins_paie')
    .select('*, employes(nom, prenom, poste, numero_cnss, date_recrutement, departement)')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (bulletinErr) {
    console.error('bulletin-pdf: erreur select bulletin', bulletinErr)
    return NextResponse.json({ error: `Erreur DB: ${bulletinErr.message}` }, { status: 500 })
  }

  if (!bulletin) return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })

  const { data: config } = await supabaseAdmin
    .from('entreprise_config')
    .select('nom, adresse, telephone, email, rccm, cnss_employeur')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise')
    .eq('id', auth.tenantId)
    .maybeSingle()

  const emp = bulletin.employes as {
    nom: string; prenom: string; poste: string
    numero_cnss?: string; date_recrutement?: string; departement?: string
  } | null

  const moisLabel = MOIS_LABELS[bulletin.mois ?? 1] ?? 'Mois'

  const payslipData = {
    nom_entreprise:   config?.nom ?? tenant?.nom_entreprise ?? 'Entreprise',
    adresse:          config?.adresse ?? undefined,
    telephone:        config?.telephone ?? undefined,
    email:            config?.email ?? undefined,
    rccm:             config?.rccm ?? undefined,
    cnss_employeur:   config?.cnss_employeur ?? undefined,
    nom:              emp?.nom ?? '',
    prenom:           emp?.prenom ?? '',
    poste:            emp?.poste ?? '',
    date_embauche:    emp?.date_recrutement ?? undefined,
    cnss_employe:     emp?.numero_cnss ?? undefined,
    total_brut:       bulletin.brut ?? undefined,
    mois:             moisLabel,
    annee:            bulletin.annee ?? new Date().getFullYear(),
    salaire_base:     bulletin.salaire_base ?? 0,
    heures_sup:       bulletin.heures_sup ?? 0,
    taux_heure_sup:   bulletin.taux_horaire ?? 0,
    primes:           bulletin.primes ?? [],
    retenues:         bulletin.retenues ?? [],
    cnss_part_employe: bulletin.cnss_salarie ?? undefined,
    irpp:             bulletin.irpp ?? undefined,
    net_a_payer:      bulletin.net ?? undefined,
    mode_paiement:    bulletin.mode_paiement ?? 'Virement',
  }

  try {
    const buffer = await renderToBuffer(
      createElement(PayslipPDF, { data: payslipData }) as ReactElement<DocumentProps>
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="bulletin-paie-${emp?.nom ?? id}-${moisLabel}-${payslipData.annee}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Bulletin PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}