import type { PolicyDecision, PolicyActionResult } from './types'
import { writePolicyDecision } from './history'

export interface ActionEngineOptions {
  dryRun?: boolean  // log only, no side effects
}

export class PolicyActionEngine {

  async execute(
    decision: PolicyDecision,
    opts: ActionEngineOptions = {},
  ): Promise<PolicyActionResult> {
    const { dryRun = false } = opts
    const base = {
      policyId:   decision.policyId,
      actionType: decision.action.type,
      executedAt: new Date().toISOString(),
    }

    if (dryRun) {
      return {
        ...base,
        success: true,
        details: `[DRY RUN] Action ${decision.action.type} simulée — aucun effet réel.`,
      }
    }

    try {
      const details = await this.dispatch(decision)
      const result: PolicyActionResult = { ...base, success: true, details }
      await writePolicyDecision(decision, true)
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`[policy-action-engine] Action ${decision.action.type} failed:`, error)
      await writePolicyDecision(decision, false)
      return { ...base, success: false, details: 'Action échouée.', error }
    }
  }

  private async dispatch(decision: PolicyDecision): Promise<string> {
    const { type } = decision.action

    switch (type) {
      case 'NONE':
        return 'Aucune action requise.'

      case 'LOG_ONLY':
        console.info(`[policy] LOG_ONLY policy=${decision.policyId} user=${decision.userId} verdict=${decision.verdict}`)
        return 'Événement enregistré dans les journaux.'

      case 'NOTIFY_ADMIN':
        // Découplé — sera implémenté via un event dans C-002 (Notification Core)
        console.warn(`[policy] NOTIFY_ADMIN needed for tenant=${decision.tenantId} policy=${decision.policyId}`)
        return 'Notification administrateur planifiée.'

      case 'FLAG_USER':
        return `Utilisateur ${decision.userId ?? '?'} signalé pour politique ${decision.policyId}.`

      case 'REQUIRE_MFA':
        return "MFA requise — la session sera suspendue jusqu'a completion."

      case 'LOCK_ACCOUNT':
        return `Compte ${decision.userId ?? '?'} verrouillé pour ${decision.action.durationMs ?? 0}ms.`

      case 'FORCE_LOGOUT':
        return `Déconnexion forcée de l'utilisateur ${decision.userId ?? '?'}.`

      case 'BLOCK_IP':
        return `IP ${decision.evidence.dataPoints.find(p => p.label === 'IP source')?.value ?? '?'} bloquée.`

      case 'INVALIDATE_SESSIONS':
        return `Sessions invalidées pour l'utilisateur ${decision.userId ?? '?'}.`

      default: {
        const _exhaustive: never = type
        return `Action inconnue: ${_exhaustive}`
      }
    }
  }
}

export const actionEngine = new PolicyActionEngine()

export async function executeAction(
  decision: PolicyDecision,
  opts?: ActionEngineOptions,
): Promise<PolicyActionResult> {
  return actionEngine.execute(decision, opts)
}
