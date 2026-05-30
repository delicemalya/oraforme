import { supabaseAdmin } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MODULE_LABELS, MODULE_PRICES, fmtFCFA } from '@/lib/admin-config'
import {
  ArrowLeft, Building2, Users, FileText,
  Package, Mail,
} from 'lucide-react'

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [tenantRes, profilesRes, facturesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('profiles').select('*').eq('tenant_id', id),
    supabaseAdmin.from('factures').select('*').eq('tenant_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const tenant = tenantRes.data
  if (!tenant) notFound()

  const profiles = profilesRes.data ?? []
  const factures = facturesRes.data ?? []

  const caGenere = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const mrr = (tenant.modules_actifs ?? []).reduce((s: number, m: string) => s + (MODULE_PRICES[m] ?? 0), 0)

  const STATUT_COLORS: Record<string, string> = {
    payee: 'text-[#DC2626] bg-[var(--surface)]/10 border-[#0F172A]/30',
    envoyee: 'text-[#DC2626] bg-[#DC2626]/10 border-[#DC2626]/30',
    brouillon: 'text-[var(--text-secondary)] bg-[var(--surface-alt)] border-[var(--border)]',
    annulee: 'text-[#DC2626] bg-[#DC2626]/10 border-[#DC2626]/30',
  }

  return (
    <div className="space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--text)]">{tenant.nom_entreprise}</h1>
          <p className="text-xs text-[var(--text-secondary)] font-mono">{tenant.id}</p>
        </div>
        <a
          href={`mailto:${profiles[0] ? '' : ''}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          <Mail size={14} />
          Contacter
        </a>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: 'Plan', value: tenant.plan ?? '—', color: '#DC2626' },
          { icon: Package, label: 'Modules actifs', value: `${(tenant.modules_actifs ?? []).length}`, color: '#DC2626' },
          { icon: FileText, label: 'CA généré', value: fmtFCFA(caGenere), color: '#0F172A' },
          { icon: Users, label: 'MRR estimé', value: fmtFCFA(mrr), color: '#DC2626' },
        ].map(c => (
          <div key={c.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-2">{c.label}</p>
            <div className="flex items-center gap-2">
              <c.icon size={15} style={{ color: c.color }} />
              <span className="text-base font-bold text-[var(--text)] truncate">{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Modules actifs */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
            <Package size={14} className="text-[#DC2626]" />
            Modules actifs
          </h2>
          <div className="space-y-2">
            {(tenant.modules_actifs ?? []).map((m: string) => (
              <div key={m} className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <span className="text-sm text-[var(--text)]">{MODULE_LABELS[m] ?? m}</span>
                <span className="text-xs text-[#DC2626] font-medium">{fmtFCFA(MODULE_PRICES[m] ?? 0)}/mois</span>
              </div>
            ))}
            {(tenant.modules_actifs ?? []).length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">Aucun module actif</p>
            )}
          </div>
        </div>

        {/* Utilisateurs */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
            <Users size={14} className="text-[#DC2626]" />
            Utilisateurs ({profiles.length})
          </h2>
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="w-7 h-7 rounded-full bg-[#DC2626]/20 border border-[#DC2626]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#DC2626] text-xs font-bold">
                    {(p.prenom || p.nom || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{[p.prenom, p.nom].filter(Boolean).join(' ') || '—'}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{p.role ?? 'user'}</p>
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className="text-sm text-[var(--text-secondary)] text-center py-4">Aucun utilisateur</p>}
          </div>
        </div>
      </div>

      {/* Factures récentes */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
          <FileText size={14} className="text-[#DC2626]" />
          Factures récentes ({factures.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Client</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Montant</th>
                <th className="text-left py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Statut</th>
                <th className="text-left py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {factures.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-[var(--text-secondary)]">Aucune facture</td></tr>
              )}
              {factures.map(f => (
                <tr key={f.id} className="hover:bg-white/5/30 transition-colors">
                  <td className="py-2.5 px-3 text-[var(--text)] truncate max-w-[180px]">{f.client_nom ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-[#DC2626]">{fmtFCFA(f.total ?? 0)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUT_COLORS[f.statut] ?? STATUT_COLORS.brouillon}`}>
                      {f.statut}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informations tenant */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Informations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'NIF', value: tenant.nif ?? '—' },
            { label: 'Plan', value: tenant.plan ?? '—' },
            { label: 'Inscription', value: new Date(tenant.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
          ].map(r => (
            <div key={r.label}>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">{r.label}</p>
              <p className="text-sm text-[var(--text)] font-medium">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
