import type { SupabaseClient } from '@supabase/supabase-js'

// Tarifs Claude au 2026 (USD / token)
const RATES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.25  / 1_000_000, output: 1.25 / 1_000_000 },
  'claude-opus-4-5':           { input: 15    / 1_000_000, output: 75   / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3     / 1_000_000, output: 15   / 1_000_000 },
  'mistral-large-latest':      { input: 3     / 1_000_000, output: 9    / 1_000_000 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] ?? RATES['claude-haiku-4-5-20251001']
  return inputTokens * r.input + outputTokens * r.output
}

export function trackUsage(
  supabase: SupabaseClient,
  tenantId: string,
  module: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const estimatedCostUsd = estimateCost(model, inputTokens, outputTokens)
  // Fire-and-forget — ne bloque jamais la réponse
  void supabase.from('miaa_usage').insert({
    tenant_id:           tenantId,
    module,
    model,
    input_tokens:        inputTokens,
    output_tokens:       outputTokens,
    estimated_cost_usd:  estimatedCostUsd,
  })
}
