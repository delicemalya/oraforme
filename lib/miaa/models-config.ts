/**
 * lib/miaa/models-config.ts — Configuration multi-modèles MIAA+
 */

export const MIAA_MODELS = {
  claude:       { id: 'claude-sonnet-4-6',          provider: 'anthropic', maxTokens: 8000,  costPer1k: 0.003  },
  claude_fast:  { id: 'claude-haiku-4-5-20251001',  provider: 'anthropic', maxTokens: 2000,  costPer1k: 0.00025 },
  claude_heavy: { id: 'claude-opus-4-8',             provider: 'anthropic', maxTokens: 16000, costPer1k: 0.015  },
  mistral:      { id: 'mistral-large-latest',        provider: 'mistral',   maxTokens: 4000,  costPer1k: 0.002  },
  mistral_ocr:  { id: 'pixtral-12b-2409',            provider: 'mistral',   maxTokens: 4000,  costPer1k: 0.002  },
} as const

export type ModelKey = keyof typeof MIAA_MODELS

// Patterns pour les questions complexes (génération de documents)
const HEAVY_RE  = /\b(génère?|génère?r|crée?|rédige?|écri(?:s|re)|prépare?|établi(?:s|r))\s+.{0,30}\b(rapport|bilan|bulletin|analyse (?:complète?|détaillée?)|état financier|tableau de bord|plan (?:d|de)|contrat|lettre|courrier)\b/i
const COMPLEX_RE = /\b(rapport|bulletin|bilan|synthèse|analyse complète|planification|stratégie|prévision détaillée|état financier|calcul détaillé)\b/i
const IMAGE_MIME = ['image/jpeg','image/png','image/webp','image/gif']

export function choisirModele(opts: {
  message:    string
  hasFile?:   boolean
  fileMime?:  string
  useClaude?: boolean
  useMistral?:boolean
}): { model: string; maxTokens: number; label: string; provider: string } {
  const { message, hasFile, fileMime, useClaude = true, useMistral = false } = opts

  // OCR image → Mistral Pixtral
  if (hasFile && fileMime && IMAGE_MIME.includes(fileMime) && useMistral) {
    const m = MIAA_MODELS.mistral_ocr
    return { model: m.id, maxTokens: m.maxTokens, label: 'Pixtral OCR', provider: m.provider }
  }

  if (!useClaude && useMistral) {
    const m = MIAA_MODELS.mistral
    return { model: m.id, maxTokens: m.maxTokens, label: 'Mistral Large', provider: m.provider }
  }

  if (HEAVY_RE.test(message)) {
    const m = MIAA_MODELS.claude_heavy
    return { model: m.id, maxTokens: m.maxTokens, label: 'Opus (génération)', provider: m.provider }
  }
  if (COMPLEX_RE.test(message) || (hasFile && !IMAGE_MIME.includes(fileMime ?? ''))) {
    const m = MIAA_MODELS.claude
    return { model: m.id, maxTokens: m.maxTokens, label: 'Sonnet (analyse)', provider: m.provider }
  }
  const m = MIAA_MODELS.claude_fast
  return { model: m.id, maxTokens: m.maxTokens, label: 'Haiku (rapide)', provider: m.provider }
}
