export function genererNumeroRecu(count: number): string {
  const year = new Date().getFullYear()
  return `RES-${year}-${String(count + 1).padStart(4, '0')}`
}

export function formatHeureRecu(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateRecu(): string {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
