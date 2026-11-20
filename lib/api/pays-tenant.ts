/**
 * pays-tenant.ts — Pays fiscal du tenant, lu en base (côté serveur).
 *
 * Source unique du pays envoyé au moteur comptable (metadata.country_code /
 * p_country_code) et au moteur fiscal (taux TVA + taxes additionnelles).
 * Remplace le 'CG' écrit en dur dans les routes (refonte 2026-11, migration 190).
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { normaliserPaysTenant, PAYS_PAR_DEFAUT } from '@/lib/fiscalite/pays-tenant'
import type { PaysFiscal } from '@/lib/fiscalite/types'

export async function getPaysTenant(tenantId: string): Promise<PaysFiscal> {
  const { data, error } = await supabaseAdmin
    .from('tenants').select('pays').eq('id', tenantId).maybeSingle()
  if (error) {
    console.warn(`[pays-tenant] lecture de tenants.pays impossible (${error.message}) — ${PAYS_PAR_DEFAUT} par défaut`)
    return PAYS_PAR_DEFAUT
  }
  return normaliserPaysTenant(data?.pays)
}
