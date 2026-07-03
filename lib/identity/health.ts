import type { AuthMetrics, IdentityHealth } from './types'

/**
 * Compute a composite IdentityHealth score from auth metrics.
 *
 * Weights:
 *  - Identity Score (success rate)  : 40%
 *  - Session Score (non-expiry rate): 25%
 *  - Availability (error absence)   : 25%
 *  - Refresh Score (token activity) : 10%
 */
export function computeIdentityHealth(metrics: AuthMetrics): IdentityHealth {
  const total = metrics.totalLogins + metrics.failedLogins

  // Identity Score: % of successful logins out of all attempts
  const identityScore = total === 0
    ? 100
    : clamp(Math.round((metrics.totalLogins / total) * 100))

  // Session Score: penalize expired sessions relative to successful logins
  const sessionBase = Math.max(metrics.totalLogins, 1)
  const sessionScore = clamp(
    100 - Math.round((metrics.expiredSessions / sessionBase) * 100)
  )

  // Refresh Score: healthy if refreshes happen (indicates active sessions)
  const refreshScore = metrics.tokenRefreshes === 0 && metrics.totalLogins === 0
    ? 100  // no logins yet — healthy by default
    : clamp(Math.min(100, Math.round(
        (metrics.tokenRefreshes / Math.max(metrics.totalLogins, 1)) * 100
      )))

  // Availability: inversely proportional to error rate
  const errorRate = total === 0 ? 0 : metrics.failedLogins / total
  const availability = clamp(Math.round((1 - errorRate) * 100))

  const globalScore = clamp(Math.round(
    identityScore * 0.40 +
    sessionScore  * 0.25 +
    availability  * 0.25 +
    refreshScore  * 0.10
  ))

  return {
    identityScore,
    sessionScore,
    refreshScore,
    authErrors:  metrics.failedLogins + metrics.blockedAttempts,
    latencyMs:   metrics.avgAuthDurationMs,
    availability,
    globalScore,
    label: globalScore >= 80 ? 'HEALTHY' : globalScore >= 50 ? 'DEGRADED' : 'CRITICAL',
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}
