import { redirect } from 'next/navigation'
import { createSupabaseServerClient as createClient } from '@/lib/supabase-client-server'
import {
  getPolicyMetrics,
  getGlobalPolicyMetrics,
  queryAuditTrail,
  ALL_POLICIES,
} from '@/lib/identity/policy'
import type { PolicyMetricsSummary } from '@/lib/identity/policy'

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())

type Period = '24h' | '7d' | '30d'

// ─── ScoreCard ────────────────────────────────────────────────────────────────

function ScoreCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?:  string
  color: 'green' | 'red' | 'yellow' | 'blue'
}) {
  const bg = {
    green:  'bg-green-50 border-green-200',
    red:    'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue:   'bg-blue-50 border-blue-200',
  }[color]

  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── PolicyRow ────────────────────────────────────────────────────────────────

function PolicyRow({ policy, count }: { policy: typeof ALL_POLICIES[0]; count: number }) {
  const severityColor: Record<string, string> = {
    LOW:      'bg-gray-100 text-gray-600',
    MEDIUM:   'bg-yellow-100 text-yellow-700',
    HIGH:     'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  }
  const verdictIcon: Record<string, string> = {
    DENY:    '🚫',
    FLAG:    '🚩',
    MONITOR: '👁',
    ALLOW:   '✅',
  }

  return (
    <tr className="border-t">
      <td className="py-3 pr-4 text-sm font-mono text-gray-500">{policy.id}</td>
      <td className="py-3 pr-4 text-sm font-medium text-gray-900">{policy.name}</td>
      <td className="py-3 pr-4">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${severityColor[policy.severity] ?? ''}`}>
          {policy.severity}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">
        {verdictIcon[policy.verdict] ?? ''} {policy.verdict}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">{policy.action.type}</td>
      <td className="py-3 text-right text-sm font-bold text-gray-900">{count}</td>
    </tr>
  )
}

// ─── RecentDecisions ─────────────────────────────────────────────────────────

async function RecentDecisions({ tenantId }: { tenantId: string }) {
  const entries = await queryAuditTrail({ tenantId, limit: 15 })

  if (!entries.length) {
    return <p className="text-sm text-gray-400">Aucune décision récente.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs font-medium uppercase text-gray-500">
            <th className="pb-2 pr-4">Politique</th>
            <th className="pb-2 pr-4">Verdict</th>
            <th className="pb-2 pr-4">Sévérité</th>
            <th className="pb-2 pr-4">Raison</th>
            <th className="pb-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="border-t text-sm">
              <td className="py-2 pr-4 font-mono text-gray-500">{e.policy_id}</td>
              <td className="py-2 pr-4">
                <span className={e.verdict === 'DENY' ? 'font-bold text-red-600' : 'text-gray-700'}>
                  {e.verdict}
                </span>
              </td>
              <td className="py-2 pr-4 text-gray-600">{e.severity}</td>
              <td className="py-2 pr-4 max-w-xs truncate text-gray-600" title={e.reason}>{e.reason}</td>
              <td className="py-2 text-gray-400">{new Date(e.created_at).toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IdentityPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tenant?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !SUPER_ADMIN_EMAILS.includes(user.email)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const period  = (['24h', '7d', '30d'].includes(params.period ?? '') ? params.period : '24h') as Period
  const tenantId = params.tenant ?? null

  const metrics: PolicyMetricsSummary = tenantId
    ? await getPolicyMetrics(tenantId, period)
    : await getGlobalPolicyMetrics(period)

  const enforcedCount = Object.values(metrics.violationsBySeverity).reduce((a, b) => a + b, 0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Identity Policy Engine</h1>
          <p className="text-sm text-gray-500">C-001.2 — {ALL_POLICIES.length} politiques actives</p>
        </div>

        <form className="flex gap-2">
          <select
            name="period"
            defaultValue={period}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="24h">24 heures</option>
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
          </select>
          <button type="submit" className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white">
            Filtrer
          </button>
        </form>
      </div>

      {/* Score cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreCard
          label="Vérifications totales"
          value={metrics.totalChecks.toLocaleString()}
          color="blue"
        />
        <ScoreCard
          label="Violations"
          value={metrics.totalViolations.toLocaleString()}
          color={metrics.totalViolations > 0 ? 'red' : 'green'}
        />
        <ScoreCard
          label="Taux d'enforcement"
          value={`${metrics.enforcementRate}%`}
          sub="% violations avec action"
          color={metrics.enforcementRate >= 80 ? 'green' : 'yellow'}
        />
        <ScoreCard
          label="Sévérité HIGH+CRITICAL"
          value={metrics.violationsBySeverity.HIGH + metrics.violationsBySeverity.CRITICAL}
          color={metrics.violationsBySeverity.HIGH + metrics.violationsBySeverity.CRITICAL > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Matrice des politiques */}
      <section className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Matrice des politiques</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-medium uppercase text-gray-500">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Nom</th>
                <th className="pb-2 pr-4">Sévérité</th>
                <th className="pb-2 pr-4">Verdict</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 text-right">Violations ({period})</th>
              </tr>
            </thead>
            <tbody>
              {ALL_POLICIES.map(policy => (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  count={metrics.violationsByPolicy[policy.id] ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Violations par sévérité */}
      <section className="mb-8 grid grid-cols-4 gap-3">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
          <div key={s} className="rounded border bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase text-gray-400">{s}</p>
            <p className="text-2xl font-bold">{metrics.violationsBySeverity[s]}</p>
          </div>
        ))}
      </section>

      {/* Décisions récentes */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Décisions récentes</h2>
        {tenantId
          ? <RecentDecisions tenantId={tenantId} />
          : <p className="text-sm text-gray-400">Sélectionnez un tenant pour voir les décisions récentes.</p>
        }
      </section>

      {/* Légende */}
      <p className="mt-4 text-center text-xs text-gray-400">
        C-001.2 Identity Policy Engine — {ALL_POLICIES.filter(p => p.enabled).length} politiques actives sur {ALL_POLICIES.length}
        {' '}— Période : {period}
      </p>
    </main>
  )
}
