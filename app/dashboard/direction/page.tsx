/**
 * Direction Générale — page universelle (tous secteurs)
 * Server component : data fetching → DirectionClient (rendu i18n)
 */

import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import DirectionClient from '@/components/dashboard/DirectionClient'

function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round(((a - b) / b) * 100)
}

export default async function DirectionPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, ecole_role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile) redirect('/login')
  const tenantId = profile.tenant_id

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  const [factures, prevFactures, employees, depenses, prevDepenses] = await Promise.all([
    supabase
      .from('factures')
      .select('montant_ttc, statut')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('factures')
      .select('montant_ttc, statut')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd),
    supabase
      .from('employees')
      .select('id, statut')
      .eq('tenant_id', tenantId),
    supabase
      .from('depenses')
      .select('montant')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('depenses')
      .select('montant')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd),
  ])

  const factureRows  = factures.data ?? []
  const prevFactRows = prevFactures.data ?? []
  const employeeRows = employees.data ?? []
  const depenseRows  = depenses.data ?? []
  const prevDepRows  = prevDepenses.data ?? []

  const ca         = factureRows.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const prevCA     = prevFactRows.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const caCollecte = factureRows.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const facImpayees = factureRows.filter(f => f.statut === 'envoyee').length
  const totalDeps  = depenseRows.reduce((s, d) => s + (d.montant ?? 0), 0)
  const prevDeps   = prevDepRows.reduce((s, d) => s + (d.montant ?? 0), 0)
  const activeEmps = employeeRows.filter(e => e.statut === 'actif').length
  const totalEmps  = employeeRows.length

  const caGrowth   = pct(ca, prevCA)
  const depGrowth  = pct(totalDeps, prevDeps)
  const marge      = ca > 0 ? Math.round(((ca - totalDeps) / ca) * 100) : 0

  return (
    <DirectionClient
      data={{
        ca, prevCA, caCollecte, totalDeps, prevDeps, marge,
        activeEmps, totalEmps, facImpayees, caGrowth, depGrowth,
      }}
    />
  )
}
