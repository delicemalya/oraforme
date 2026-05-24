import { supabaseAdmin } from '@/lib/supabase-server'
import AdminClientsTable from '@/components/admin/AdminClientsTable'
import { Building2 } from 'lucide-react'

export default async function AdminClientsPage() {
  const [tenantsRes, profilesRes, facturesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, plan, modules_actifs, created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, tenant_id'),
    supabaseAdmin.from('factures').select('id, tenant_id, total, statut'),
  ])

  const tenants  = tenantsRes.data  ?? []
  const profiles = profilesRes.data ?? []
  const factures = facturesRes.data ?? []

  const tenantRows = tenants.map(t => ({
    id: t.id,
    nom_entreprise: t.nom_entreprise,
    plan: t.plan,
    modules_actifs: t.modules_actifs ?? [],
    nb_users:    profiles.filter(p => p.tenant_id === t.id).length,
    nb_factures: factures.filter(f => f.tenant_id === t.id).length,
    ca_genere:   factures.filter(f => f.tenant_id === t.id && f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0),
    created_at: t.created_at,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center">
          <Building2 size={18} className="text-[#DC2626]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Clients</h1>
          <p className="text-xs text-[var(--text-secondary)]">{tenantRows.length} entreprise{tenantRows.length > 1 ? 's' : ''} inscrite{tenantRows.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <AdminClientsTable tenants={tenantRows} />
      </div>
    </div>
  )
}
