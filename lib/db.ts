/**
 * lib/db.ts — Wrapper Supabase avec gestion d'erreurs visible
 *
 * Remplace les `supabase.from(...)` silencieux.
 * Chaque erreur est loggée en console ET retournée proprement.
 *
 * Usage :
 *   const { data, error } = await db.insert('achats', { tenant_id, ... })
 *   if (error) { showToast(error); return }
 */

import { supabase } from '@/lib/supabase'

function logError(op: string, table: string, error: { message: string; code?: string; details?: string }) {
  console.error(`[DB ${op} "${table}"]`, error.message, {
    code:    error.code,
    details: error.details,
    hint:    'Vérifier RLS Supabase ou contraintes de la table',
  })
}

/** INSERT avec retour d'erreur visible */
export async function dbInsert(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
): Promise<{ data: unknown; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table) as any).insert(payload).select().single()
  if (error) {
    logError('INSERT', table, error)
    return { data: null, error: formatError(error) }
  }
  return { data, error: null }
}

/** UPDATE avec retour d'erreur visible */
export async function dbUpdate(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  match: Record<string, unknown>
): Promise<{ data: unknown; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (supabase.from(table) as any).update(payload)
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v)
  const { data, error } = await query.select()
  if (error) {
    logError('UPDATE', table, error)
    return { data: null, error: formatError(error) }
  }
  return { data, error: null }
}

/** DELETE avec retour d'erreur visible */
export async function dbDelete(
  table: string,
  match: Record<string, unknown>
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (supabase.from(table) as any).delete()
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v)
  const { error } = await query
  if (error) {
    logError('DELETE', table, error)
    return { error: formatError(error) }
  }
  return { error: null }
}

function formatError(error: { message: string; code?: string }): string {
  if (error.code === '42501') return 'Accès refusé — permissions insuffisantes (RLS)'
  if (error.code === '23503') return 'Référence invalide — enregistrement lié introuvable'
  if (error.code === '23505') return 'Doublon — cet enregistrement existe déjà'
  if (error.code === '23502') return 'Champ obligatoire manquant'
  if (error.message?.includes('JWT')) return 'Session expirée — rechargez la page'
  if (error.message?.includes('row-level security')) return 'Accès refusé (RLS) — vérifiez vos permissions'
  return error.message ?? 'Erreur inconnue'
}
