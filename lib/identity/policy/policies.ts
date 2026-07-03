import type { IdentityPolicy, PolicyContext } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ipPrefix16(ip: string | null): string | null {
  if (!ip) return null
  const parts = ip.split('.')
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : null
}

function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000
}

function deviceFingerprint(device: string | null, browser: string | null): string | null {
  if (!device && !browser) return null
  return `${device ?? 'unknown'}:${browser ?? 'unknown'}`
}

// ─────────────────────────────────────────────────────────────────────────────
// P-001 — BRUTE_FORCE_DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export const P001_BRUTE_FORCE: IdentityPolicy = {
  id:          'P-001-BRUTE-FORCE',
  name:        'Brute Force Detection',
  description: 'Detecte les tentatives repetees de connexion echouees depuis la meme IP.',
  severity:    'HIGH',
  priority:    1,
  triggerEvents: ['LOGIN_FAILED'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) =>
    ctx.recentHistory.failedLoginsByIpLast15m >= 5,

  verdict: 'DENY',
  action: {
    type:       'LOCK_ACCOUNT',
    durationMs: 15 * 60 * 1000,
    reason:     '5 tentatives echouees consecutives depuis la meme IP en 15 minutes.',
  },

  exceptions: [
    {
      description: 'IP interne exclue (10.x.x.x)',
      condition: (ctx) => ctx.event.ip?.startsWith('10.') ?? false,
    },
  ],

  explanation: (ctx) =>
    `Votre compte a ete temporairement verrouille apres ${ctx.recentHistory.failedLoginsByIpLast15m} tentatives echouees depuis l'adresse IP ${ctx.event.ip ?? 'inconnue'}. Reessayez dans 15 minutes.`,

  evidence: (ctx) => ({
    triggeredBy: 'Tentatives de connexion echouees repetees',
    threshold:   5,
    observed:    ctx.recentHistory.failedLoginsByIpLast15m,
    dataPoints: [
      { label: 'IP source',                 value: ctx.event.ip },
      { label: 'Echecs (15 dernieres min)', value: ctx.recentHistory.failedLoginsByIpLast15m },
      { label: 'Echecs (1 derniere heure)', value: ctx.recentHistory.failedLoginsLast1h },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: true, alertThreshold: 10 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-002 — UNUSUAL_COUNTRY (IP-prefix heuristic)
// ─────────────────────────────────────────────────────────────────────────────

export const P002_UNUSUAL_COUNTRY: IdentityPolicy = {
  id:          'P-002-UNUSUAL-COUNTRY',
  name:        'Connexion depuis pays/reseau inhabituel',
  description: 'Detecte une connexion depuis un sous-reseau IP non vu dans les 30 derniers jours.',
  severity:    'MEDIUM',
  priority:    3,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    if (!ctx.event.ip) return false
    const knownPrefixes = ctx.recentHistory.loginSuccessLast30d
      .map(e => ipPrefix16(e.ip))
      .filter(Boolean) as string[]
    if (knownPrefixes.length < 3) return false
    const currentPrefix = ipPrefix16(ctx.event.ip)
    return !!currentPrefix && !knownPrefixes.includes(currentPrefix)
  },

  verdict: 'FLAG',
  action: {
    type:   'NOTIFY_ADMIN',
    reason: 'Connexion depuis un sous-reseau IP non reconnu dans les 30 derniers jours.',
  },

  exceptions: [
    {
      description: "Premier login — pas assez d'historique",
      condition: (ctx) => ctx.recentHistory.loginSuccessLast30d.length < 3,
    },
  ],

  explanation: (ctx) =>
    `Connexion depuis l'adresse ${ctx.event.ip ?? 'inconnue'} qui n'a pas ete vue dans les 30 derniers jours. Si ce n'etait pas vous, changez votre mot de passe immediatement.`,

  evidence: (ctx) => ({
    triggeredBy: "IP non reconnue dans l'historique de connexion",
    dataPoints: [
      { label: 'IP actuelle',       value: ctx.event.ip },
      { label: 'Prefixe /16',       value: ipPrefix16(ctx.event.ip) },
      { label: 'IPs connues (/16)', value: [...new Set(ctx.recentHistory.loginSuccessLast30d.map(e => ipPrefix16(e.ip)).filter(Boolean))].join(', ') || '—' },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: true, alertThreshold: 5 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-003 — IP_CHANGE_BRUTAL
// ─────────────────────────────────────────────────────────────────────────────

export const P003_IP_CHANGE_BRUTAL: IdentityPolicy = {
  id:          'P-003-IP-CHANGE-BRUTAL',
  name:        "Changement brutal d'adresse IP",
  description: "Detecte un changement de classe A d'IP (/8) entre les dernieres connexions, signal possible de session hijack.",
  severity:    'HIGH',
  priority:    2,
  triggerEvents: ['LOGIN_SUCCESS', 'TOKEN_REFRESH'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    if (!ctx.event.ip) return false
    const recentIps = ctx.recentHistory.loginSuccessLast30d
      .slice(-5)
      .map(e => e.ip)
      .filter((ip): ip is string => !!ip)
    if (recentIps.length < 2) return false
    const currentA = parseInt(ctx.event.ip.split('.')[0] ?? '0')
    return recentIps.every(ip => {
      const prevA = parseInt(ip.split('.')[0] ?? '0')
      return Math.abs(currentA - prevA) > 50
    })
  },

  verdict: 'FLAG',
  action: {
    type:   'INVALIDATE_SESSIONS',
    reason: 'Changement brutal de reseau detecte — possible session hijacking.',
  },

  exceptions: [
    {
      description: 'Moins de 2 IPs historiques — pas de comparaison possible',
      condition: (ctx) => ctx.recentHistory.loginSuccessLast30d.length < 2,
    },
  ],

  explanation: (ctx) =>
    `Une connexion inhabituelle a ete detectee depuis ${ctx.event.ip ?? 'une IP inconnue'}, significativement differente de vos connexions habituelles. Vos sessions ont ete invalidees par mesure de securite.`,

  evidence: (ctx) => ({
    triggeredBy: 'Changement de classe A (/8) entre connexions consecutives',
    dataPoints: [
      { label: 'IP actuelle',     value: ctx.event.ip },
      { label: '5 dernieres IPs', value: ctx.recentHistory.loginSuccessLast30d.slice(-5).map(e => e.ip).filter(Boolean).join(', ') || '—' },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: true, alertThreshold: 3 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-004 — EXCESSIVE_SIMULTANEOUS_SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

export const P004_EXCESSIVE_SESSIONS: IdentityPolicy = {
  id:          'P-004-EXCESSIVE-SESSIONS',
  name:        'Sessions simultanees excessives',
  description: 'Detecte un nombre anormal de sessions actives pour un meme utilisateur.',
  severity:    'MEDIUM',
  priority:    5,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) =>
    ctx.recentHistory.activeSessionsLast4h > ctx.tenantConfig.maxSimultaneousSessions,

  verdict: 'FLAG',
  action: {
    type:   'NOTIFY_ADMIN',
    reason: 'Nombre de sessions actives simultanees depasse la limite configuree.',
  },

  exceptions: [],

  explanation: (ctx) =>
    `${ctx.recentHistory.activeSessionsLast4h} sessions actives detectees (maximum autorise : ${ctx.tenantConfig.maxSimultaneousSessions}). Verifiez si toutes ces sessions sont legitimes.`,

  evidence: (ctx) => ({
    triggeredBy: 'Sessions actives superieures au seuil tenant',
    threshold:   ctx.tenantConfig.maxSimultaneousSessions,
    observed:    ctx.recentHistory.activeSessionsLast4h,
    dataPoints: [
      { label: 'Sessions actives (4h)', value: ctx.recentHistory.activeSessionsLast4h },
      { label: 'Maximum autorise',      value: ctx.tenantConfig.maxSimultaneousSessions },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: false, alertThreshold: 20 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-005 — ABNORMAL_TOKEN_REFRESH
// ─────────────────────────────────────────────────────────────────────────────

export const P005_ABNORMAL_REFRESH: IdentityPolicy = {
  id:          'P-005-ABNORMAL-REFRESH',
  name:        'Refresh Token anormal',
  description: "Detecte un taux de refresh token anormalement eleve — signe possible d'une boucle ou d'un client malveillant.",
  severity:    'LOW',
  priority:    8,
  triggerEvents: ['TOKEN_REFRESH'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) =>
    ctx.recentHistory.tokenRefreshesLast1h > 10,

  verdict: 'MONITOR',
  action: {
    type:   'LOG_ONLY',
    reason: 'Taux de refresh token superieur a 10/heure — surveillance activee.',
  },

  exceptions: [],

  explanation: (ctx) =>
    `${ctx.recentHistory.tokenRefreshesLast1h} rafraichissements de token detectes en 1 heure (seuil normal : 10). Verifiez le comportement de votre client.`,

  evidence: (ctx) => ({
    triggeredBy: 'Frequence de TOKEN_REFRESH excessive',
    threshold:   10,
    observed:    ctx.recentHistory.tokenRefreshesLast1h,
    dataPoints: [
      { label: 'Refreshes (1h)', value: ctx.recentHistory.tokenRefreshesLast1h },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: false, alertThreshold: 50 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-006 — INACTIVE_ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

export const P006_INACTIVE_ACCOUNT: IdentityPolicy = {
  id:          'P-006-INACTIVE-ACCOUNT',
  name:        'Compte inactif reactivé',
  description: "Detecte la reconnexion d'un compte sans activite depuis plus de 90 jours.",
  severity:    'LOW',
  priority:    9,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    const last = ctx.recentHistory.lastLoginSuccessAt
    if (!last) return false
    return daysSince(last) > 90
  },

  verdict: 'MONITOR',
  action: {
    type:   'NOTIFY_ADMIN',
    reason: "Reconnexion d'un compte inactif depuis plus de 90 jours.",
  },

  exceptions: [
    {
      description: 'Nouveau compte — jamais connecte avant',
      condition: (ctx) => ctx.recentHistory.lastLoginSuccessAt === null,
    },
  ],

  explanation: (ctx) =>
    `Ce compte n'avait pas de connexion depuis ${ctx.recentHistory.lastLoginSuccessAt ? Math.floor(daysSince(ctx.recentHistory.lastLoginSuccessAt)) : '?'} jours. L'administrateur a ete notifie.`,

  evidence: (ctx) => ({
    triggeredBy: 'Inactivite du compte superieure a 90 jours',
    threshold:   90,
    observed:    ctx.recentHistory.lastLoginSuccessAt ? Math.floor(daysSince(ctx.recentHistory.lastLoginSuccessAt)) : 0,
    dataPoints: [
      { label: 'Derniere connexion', value: ctx.recentHistory.lastLoginSuccessAt ?? '—' },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: false, alertThreshold: 100 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-007 — PASSWORD_EXPIRED
// ─────────────────────────────────────────────────────────────────────────────

export const P007_PASSWORD_EXPIRED: IdentityPolicy = {
  id:          'P-007-PASSWORD-EXPIRED',
  name:        'Mot de passe expire',
  description: 'Detecte une connexion avec un mot de passe non renouvele depuis plus de N jours (configurable par tenant).',
  severity:    'MEDIUM',
  priority:    6,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    const last = ctx.recentHistory.lastPasswordResetAt
    if (!last) return true
    return daysSince(last) > ctx.tenantConfig.passwordExpiryDays
  },

  verdict: 'FLAG',
  action: {
    type:   'REQUIRE_MFA',
    reason: 'Mot de passe expire — verification supplementaire requise.',
  },

  exceptions: [
    {
      description: 'OAuth provider — pas de mot de passe local',
      condition: (ctx) => ctx.event.provider === 'google' || ctx.event.provider === 'azure',
    },
  ],

  explanation: (ctx) => {
    const last = ctx.recentHistory.lastPasswordResetAt
    return last
      ? `Votre mot de passe n'a pas ete change depuis ${Math.floor(daysSince(last))} jours (expiration : ${ctx.tenantConfig.passwordExpiryDays} jours). Veuillez le renouveler.`
      : "Vous n'avez jamais change votre mot de passe. Veuillez le definir des maintenant."
  },

  evidence: (ctx) => ({
    triggeredBy: 'Mot de passe expire selon politique tenant',
    threshold:   ctx.tenantConfig.passwordExpiryDays,
    observed:    ctx.recentHistory.lastPasswordResetAt ? Math.floor(daysSince(ctx.recentHistory.lastPasswordResetAt)) : 999,
    dataPoints: [
      { label: 'Dernier reset MDP',  value: ctx.recentHistory.lastPasswordResetAt ?? 'Jamais' },
      { label: 'Expiration (jours)', value: ctx.tenantConfig.passwordExpiryDays },
      { label: 'Provider',           value: ctx.event.provider },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: true, alertThreshold: 50 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-008 — MFA_REQUIRED
// ─────────────────────────────────────────────────────────────────────────────

export const P008_MFA_REQUIRED: IdentityPolicy = {
  id:          'P-008-MFA-REQUIRED',
  name:        'MFA obligatoire',
  description: "Bloque la session si le tenant exige la MFA et que l'utilisateur ne l'a pas completee recemment.",
  severity:    'HIGH',
  priority:    4,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) =>
    ctx.tenantConfig.mfaRequired && ctx.recentHistory.mfaSuccessLast1h === 0,

  verdict: 'DENY',
  action: {
    type:   'REQUIRE_MFA',
    reason: 'MFA obligatoire par politique tenant — pas de MFA_SUCCESS dans la derniere heure.',
  },

  exceptions: [
    {
      description: 'MFA non activee pour ce tenant',
      condition: (ctx) => !ctx.tenantConfig.mfaRequired,
    },
  ],

  explanation: (_ctx) =>
    'Votre organisation exige une verification en deux etapes. Veuillez completer la MFA pour acceder a votre compte.',

  evidence: (ctx) => ({
    triggeredBy: 'MFA obligatoire selon politique tenant, MFA_SUCCESS absent',
    dataPoints: [
      { label: 'MFA obligatoire (config)', value: ctx.tenantConfig.mfaRequired },
      { label: 'MFA_SUCCESS (1h)',         value: ctx.recentHistory.mfaSuccessLast1h },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: false, alertThreshold: 5 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-009 — SESSION_TOO_LONG
// ─────────────────────────────────────────────────────────────────────────────

export const P009_SESSION_TOO_LONG: IdentityPolicy = {
  id:          'P-009-SESSION-TOO-LONG',
  name:        'Session trop longue',
  description: 'Force la deconnexion si la session active depasse la duree maximale configuree.',
  severity:    'MEDIUM',
  priority:    7,
  triggerEvents: ['TOKEN_REFRESH'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    if (!ctx.sessionStartedAt) return false
    const ageMs = Date.now() - new Date(ctx.sessionStartedAt).getTime()
    return ageMs > ctx.tenantConfig.maxSessionDurationMs
  },

  verdict: 'DENY',
  action: {
    type:   'FORCE_LOGOUT',
    reason: 'Duree maximale de session depassee — reconnexion requise.',
  },

  exceptions: [],

  explanation: (ctx) => {
    const maxH = Math.round(ctx.tenantConfig.maxSessionDurationMs / 3_600_000)
    return `Votre session a depasse la duree maximale autorisee (${maxH}h). Veuillez vous reconnecter.`
  },

  evidence: (ctx) => ({
    triggeredBy: 'Duree de session superieure au maximum configure',
    threshold:   ctx.tenantConfig.maxSessionDurationMs,
    observed:    ctx.sessionStartedAt ? Date.now() - new Date(ctx.sessionStartedAt).getTime() : 0,
    dataPoints: [
      { label: 'Session demarree a', value: ctx.sessionStartedAt ?? '—' },
      { label: 'Duree max (ms)',     value: ctx.tenantConfig.maxSessionDurationMs },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: false, alertThreshold: 100 },
}

// ─────────────────────────────────────────────────────────────────────────────
// P-010 — UNKNOWN_DEVICE
// ─────────────────────────────────────────────────────────────────────────────

export const P010_UNKNOWN_DEVICE: IdentityPolicy = {
  id:          'P-010-UNKNOWN-DEVICE',
  name:        'Appareil inconnu',
  description: 'Detecte une connexion depuis une combinaison device+browser non vue dans les 30 derniers jours.',
  severity:    'MEDIUM',
  priority:    10,
  triggerEvents: ['LOGIN_SUCCESS'],
  version:     1,
  enabled:     true,
  delayMs:     0,

  condition: (ctx: PolicyContext) => {
    const fp = deviceFingerprint(ctx.event.device, ctx.event.browser)
    if (!fp || fp === 'unknown:unknown') return false
    if (ctx.recentHistory.deviceFingerprintsLast30d.length === 0) return false
    return !ctx.recentHistory.deviceFingerprintsLast30d.includes(fp)
  },

  verdict: 'FLAG',
  action: {
    type:   'NOTIFY_ADMIN',
    reason: 'Connexion depuis un appareil/navigateur non reconnu dans les 30 derniers jours.',
  },

  exceptions: [
    {
      description: "Aucun historique d'appareils — premier login",
      condition: (ctx) => ctx.recentHistory.deviceFingerprintsLast30d.length === 0,
    },
  ],

  explanation: (ctx) =>
    `Connexion depuis un ${ctx.event.device ?? 'appareil'} avec ${ctx.event.browser ?? 'un navigateur'} non reconnu. Si ce n'etait pas vous, verrouillez votre compte immediatement.`,

  evidence: (ctx) => ({
    triggeredBy: "Empreinte device+browser non trouvee dans l'historique 30 jours",
    dataPoints: [
      { label: 'Device actuel',      value: ctx.event.device },
      { label: 'Browser actuel',     value: ctx.event.browser },
      { label: 'Empreinte',          value: deviceFingerprint(ctx.event.device, ctx.event.browser) },
      { label: 'Empreintes connues', value: ctx.recentHistory.deviceFingerprintsLast30d.join(', ') || '—' },
    ],
  }),

  metrics: { trackViolations: true, trackFalsePositive: true, alertThreshold: 10 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — ordered by priority
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_POLICIES: IdentityPolicy[] = [
  P001_BRUTE_FORCE,
  P003_IP_CHANGE_BRUTAL,
  P002_UNUSUAL_COUNTRY,
  P008_MFA_REQUIRED,
  P004_EXCESSIVE_SESSIONS,
  P007_PASSWORD_EXPIRED,
  P009_SESSION_TOO_LONG,
  P005_ABNORMAL_REFRESH,
  P006_INACTIVE_ACCOUNT,
  P010_UNKNOWN_DEVICE,
].sort((a, b) => a.priority - b.priority)

export function getPolicyById(id: string): IdentityPolicy | undefined {
  return ALL_POLICIES.find(p => p.id === id)
}

export function getPoliciesForEvent(eventType: string): IdentityPolicy[] {
  return ALL_POLICIES.filter(p => p.enabled && p.triggerEvents.includes(eventType as never))
}
