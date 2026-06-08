import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { EmployeInput } from '@/lib/declarations/cnss-congo'

/**
 * GET /api/declarations/cnss/preremplir?mois=X&annee=Y
 * Charge les bulletins de paie du mois pour pré-remplir la déclaration CNSS.
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireTenant()
  if (error) return NextResponse.json({ error }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mois  = parseInt(searchParams.get('mois')  ?? String(new Date().getMonth() + 1))
  const annee = parseInt(searchParams.get('annee') ?? String(new Date().getFullYear()))

  const { data: bulletins, error: errBulletins } = await supabaseAdmin
    .from('bulletins_paie')
    .select(`
      brut,
      employe_id,
      employes (
        id,
        nom,
        postnom,
        prenom,
        numero_cnss,
        matricule,
        poste,
        departement
      )
    `)
    .eq('tenant_id', ctx.tenantId)
    .eq('mois', mois)
    .eq('annee', annee)
    .in('statut', ['generee', 'validee', 'payee'])
    .order('created_at')

  if (errBulletins) {
    return NextResponse.json({ error: errBulletins.message }, { status: 500 })
  }

  if (!bulletins || bulletins.length === 0) {
    return NextResponse.json({ employes: [], mois, annee, nb: 0 })
  }

  type EmpRow = { id: string; nom: string; postnom?: string | null; prenom: string; numero_cnss?: string | null; matricule?: string | null; poste?: string | null }

  const employes: EmployeInput[] = []
  for (const b of bulletins) {
    if (!b.employes) continue
    const raw = b.employes as unknown
    const emp: EmpRow = Array.isArray(raw) ? raw[0] : raw as EmpRow
    if (!emp?.id) continue
    employes.push({
      employe_id:  emp.id,
      nom:         emp.nom,
      postnom:     emp.postnom ?? null,
      prenom:      emp.prenom,
      numero_cnss: emp.numero_cnss ?? null,
      matricule:   emp.matricule ?? null,
      poste:       emp.poste ?? null,
      salaire_brut: Number(b.brut),
    })
  }

  return NextResponse.json({ employes, mois, annee, nb: employes.length })
}
