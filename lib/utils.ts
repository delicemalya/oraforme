import { type ClassValue } from 'clsx'

// ── Palette de couleurs de marque par tenant ──────────────────────────────────
// Chaque tenant reçoit une couleur déterministe basée sur un hash de son UUID.
// Le résultat est stable : même tenant = toujours même couleur.
const TENANT_BRAND_COLORS = [
  '#2977ac', '#04a269', '#042654', '#258571',
  '#f38604', '#830a65', '#0148b7', '#268d82',
]

export function getTenantBrandColor(tenantId: string): string {
  let hash = 0
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i)
    hash |= 0
  }
  return TENANT_BRAND_COLORS[Math.abs(hash) % TENANT_BRAND_COLORS.length]
}

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount)
}
