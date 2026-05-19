import { supabaseAdmin } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MODULE_LABELS, MODULE_PRICES, fmtFCFA } from '@/lib/admin-config'
import {
  ArrowLeft, Building2, Users, FileText,
  Package, Calendar, Mail,
} from 'lucide-react'

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [tenantRes, profilesRes, facturesRes, employesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('profiles').select('*').eq('tenant_id', id),
    supabaseAdmin.from('factures').select('*').eq('tenant_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('employes').select('id, nom, poste, contrat, created_at').eq('tenant_id', id).limit(10),
  ])

  const tenant = tenantRes.data
  if (!tenant) notFound()

  const profiles = profilesRes.data ?? []
  const factures = facturesRes.data ?? []
  const employes = employesRes.data ?? []

  const caGenere = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const mrr = (tenant.modules_actifs ?? []).reduce((s: number, m: string) => s + (MODULE_PRICES[m] ?? 0), 0)

  const STATUT_COLORS: Record<string, string> = {
    payee: 'text-[#0D2147] bg-[#0D2147]/10 border-[#0D2147]/30',
    envoyee: 'text-[#F07900] bg-[#F07900]/10 border-[#F07900]/30',
    brouillon: 'text-[#8B949E] bg-[#21262D] border-[#30363D]',
    annulee: 'text-[#F01F38] bg-[#F01F38]/10 border-[#F01F38]/30',
  }

  return (
    <div className="space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#E6EDF3]">{tenant.nom_entreprise}</h1>
          <p className="text-xs text-[#484F58] font-mono">{tenant.id}</p>
        </div>
        <a
          href={`mailto:${profiles[0] ? '' : ''}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
        >
          <Mail size={14} />
          Contacter
        </a>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: 'Plan', value: tenant.plan ?? '—', color: '#F0A30A' },
          { icon: Package, label: 'Modules actifs', value: `${(tenant.modules_actifs ?? []).length}`, color: '#F07900' },
          { icon: FileText, label: 'CA généré', value: fmtFCFA(caGenere), color: '#0D2147' },
          { icon: Users, label: 'MRR estimé', value: fmtFCFA(mrr), color: '#F01F38' },
        ].map(c => (
          <div key={c.label} className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
            <p className="text-xs text-[#484F58] uppercase tracking-wider mb-2">{c.label}</p>
            <div className="flex items-center gap-2">
              <c.icon size={15} style={{ color: c.color }} />
              <span className="text-base font-bold text-[#E6EDF3] truncate">{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Modules actifs */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
            <Package size={14} className="text-[#F01F38]" />
            Modules actifs
          </h2>
          <div className="space-y-2">
            {(tenant.modules_actifs ?? []).map((m: string) => (
              <div key={m} className="flex items-center justify-between px-3 py-2 bg-[#0D1117] rounded-lg border border-[#21262D]">
                <span className="text-sm text-[#E6EDF3]">{MODULE_LABELS[m] ?? m}</span>
                <span className="text-xs text-[#F0A30A] font-medium">{fmtFCFA(MODULE_PRICES[m] ?? 0)}/mois</span>
              </div>
            ))}
            {(tenant.modules_actifs ?? []).length === 0 && (
              <p className="text-sm text-[#484F58] text-center py-4">Aucun module actif</p>
            )}
          </div>
        </div>

        {/* Utilisateurs */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
            <Users size={14} className="text-[#F01F38]" />
            Utilisateurs ({profiles.length})
          </h2>
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-[#0D1117] rounded-lg border border-[#21262D]">
                <div className="w-7 h-7 rounded-full bg-[#F0A30A]/20 border border-[#F0A30A]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#F0A30A] text-xs font-bold">
                    {(p.prenom || p.nom || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E6EDF3] truncate">{[p.prenom, p.nom].filter(Boolean).join(' ') || '—'}</p>
                  <p className="text-xs text-[#484F58]">{p.role ?? 'user'}</p>
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className="text-sm text-[#484F58] text-center py-4">Aucun utilisateur</p>}
          </div>
        </div>
      </div>

      {/* Factures récentes */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <FileText size={14} className="text-[#F01F38]" />
          Factures récentes ({factures.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D]">
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Client</th>
                <th className="text-right py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Montant</th>
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Statut</th>
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262D]">
              {factures.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-[#484F58]">Aucune facture</td></tr>
              )}
              {factures.map(f => (
                <tr key={f.id} className="hover:bg-[#21262D]/30 transition-colors">
                  <td className="py-2.5 px-3 text-[#E6EDF3] truncate max-w-[180px]">{f.client_nom ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-[#F0A30A]">{fmtFCFA(f.total ?? 0)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUT_COLORS[f.statut] ?? STATUT_COLORS.brouillon}`}>
                      {f.statut}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#8B949E] text-xs whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informations tenant */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4">Informations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'NIF', value: tenant.nif ?? '—' },
            { label: 'Plan', value: tenant.plan ?? '—' },
            { label: 'Inscription', value: new Date(tenant.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
          ].map(r => (
            <div key={r.label}>
              <p className="text-xs text-[#484F58] uppercase tracking-wider mb-1">{r.label}</p>
              <p className="text-sm text-[#E6EDF3] font-medium">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
