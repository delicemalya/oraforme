import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerCNSSEmploye, calculerDeclarationGlobale } from '@/lib/declarations/cnss-congo'
import { exporterExcelCNSS, exporterExcelCNSSTUS, nomFichierCNSS } from '@/lib/declarations/export-cnss'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') ?? 'cnss') as 'cnss' | 'cnss-tus'

  const { data: decl } = await supabaseAdmin
    .from('declarations_cnss')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!decl) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data: lignes } = await supabaseAdmin
    .from('declarations_cnss_lignes')
    .select('*')
    .eq('declaration_id', decl.id)
    .order('numero_ordre')

  const employes = (lignes ?? []).map((l: Record<string, unknown>, i: number) =>
    calculerCNSSEmploye(i + 1, {
      employe_id:  l.employe_id as string | undefined,
      nom:         l.nom as string,
      postnom:     l.postnom as string | null,
      prenom:      l.prenom as string,
      numero_cnss: l.numero_cnss as string | null,
      matricule:   l.matricule as string | null,
      poste:       l.poste as string | null,
      salaire_brut: Number(l.salaire_brut),
    })
  )
  const recap    = calculerDeclarationGlobale(employes)
  const declFull = { ...decl, employes, recap }

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('nom_entreprise').eq('id', ctx.tenantId).single()

  const entreprise = (tenant?.nom_entreprise as string | undefined) ?? 'Entreprise'
  const raw        = type === 'cnss-tus'
    ? exporterExcelCNSSTUS(declFull, entreprise)
    : exporterExcelCNSS(declFull, entreprise)
  const bytes      = new Uint8Array(raw)
  const filename   = nomFichierCNSS(declFull, type)

  return new Response(bytes, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(bytes.length),
    },
  })
}
