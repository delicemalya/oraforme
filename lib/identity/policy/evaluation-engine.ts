import type { PolicyContext, PolicyDecision, IdentityPolicy } from './types'
import { ALL_POLICIES, getPoliciesForEvent } from './policies'

export interface EvaluationOptions {
  stopOnFirstDeny?: boolean  // default false — evaluate all applicable policies
  enabledOnly?: boolean      // default true
}

export interface EvaluationResult {
  decisions:    PolicyDecision[]
  denyDecision: PolicyDecision | null  // highest-priority DENY if any
  allVerdicts:  string[]
}

export class PolicyEvaluationEngine {

  private readonly policies: IdentityPolicy[]

  constructor(policies: IdentityPolicy[] = ALL_POLICIES) {
    this.policies = policies
  }

  evaluate(ctx: PolicyContext, opts: EvaluationOptions = {}): EvaluationResult {
    const {
      stopOnFirstDeny = false,
      enabledOnly     = true,
    } = opts

    const candidates = this.selectPolicies(ctx.event.type, enabledOnly)
    const decisions:  PolicyDecision[] = []

    for (const policy of candidates) {
      const isException = policy.exceptions.some(ex => ex.condition(ctx))
      if (isException) continue

      const triggered = policy.condition(ctx)
      if (!triggered) continue

      const decision = this.buildDecision(policy, ctx)
      decisions.push(decision)

      if (stopOnFirstDeny && decision.verdict === 'DENY') break
    }

    const denyDecision = decisions.find(d => d.verdict === 'DENY') ?? null

    return {
      decisions,
      denyDecision,
      allVerdicts: decisions.map(d => d.verdict),
    }
  }

  private selectPolicies(eventType: string, enabledOnly: boolean): IdentityPolicy[] {
    return this.policies.filter(p => {
      if (enabledOnly && !p.enabled) return false
      return p.triggerEvents.includes(eventType as never)
    })
  }

  private buildDecision(policy: IdentityPolicy, ctx: PolicyContext): PolicyDecision {
    return {
      policyId:    policy.id,
      policyName:  policy.name,
      tenantId:    ctx.event.tenantId,
      userId:      ctx.event.userId,
      requestId:   ctx.event.requestId,
      verdict:     policy.verdict,
      severity:    policy.severity,
      reason:      policy.explanation(ctx),
      action:      policy.action,
      evidence:    policy.evidence(ctx),
      triggeredAt: new Date().toISOString(),
      delayMs:     policy.delayMs,
    }
  }
}

// Singleton for production use
export const policyEngine = new PolicyEvaluationEngine()

export function evaluatePolicies(ctx: PolicyContext, opts?: EvaluationOptions): EvaluationResult {
  return policyEngine.evaluate(ctx, opts)
}
