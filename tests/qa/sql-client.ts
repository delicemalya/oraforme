/**
 * tests/qa/sql-client.ts — Client SQL pour les preuves Supabase dans les tests QA
 *
 * Exécute des requêtes SQL via l'API Supabase avec service_role.
 * Retourne le résultat + le temps d'exécution pour les SqlProof.
 */

import type { SqlProof } from './types.js'

const PROJECT_ID      = 'mrzixapnaqsbqmagivvf'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — requis pour sqlProof')

export async function sqlProof(label: string, query: string): Promise<SqlProof> {
  const t0 = Date.now()

  const res = await fetch(
    `https://${PROJECT_ID}.supabase.co/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        'apikey':        SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )

  // exec_sql n'existe pas par défaut — fallback via supabase-js-compatible endpoint
  // On utilise la Management API à la place
  if (!res.ok) {
    // Fallback : appel direct via le endpoint SQL de Supabase Management API
    // Nécessite SUPABASE_ACCESS_TOKEN en plus du service role — on tente quand même
    const r2 = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN ?? ''}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ query }),
      },
    )

    if (r2.ok) {
      const data = await r2.json()
      return {
        label,
        query,
        result: data,
        rows:   Array.isArray(data) ? data.length : (data?.rows?.length ?? 0),
        durationMs: Date.now() - t0,
      }
    }

    // Aucun endpoint SQL disponible — retourner un proof marqué comme non-exécuté
    return {
      label,
      query,
      result:    { error: 'SQL proof endpoint not available — verify via Supabase console' },
      rows:      -1,
      durationMs: Date.now() - t0,
    }
  }

  const data = await res.json()
  return {
    label,
    query,
    result:    data,
    rows:      Array.isArray(data) ? data.length : 0,
    durationMs: Date.now() - t0,
  }
}

/** Exécute via Supabase REST (GET sur une vue ou table) comme preuve de lecture */
export async function tableProof(
  label: string,
  table: string,
  filter: string,
): Promise<SqlProof> {
  const t0  = Date.now()
  const url = `https://${PROJECT_ID}.supabase.co/rest/v1/${table}?${filter}&select=*`

  const res = await fetch(url, {
    headers: {
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer':        'count=exact',
    },
  })

  const data = res.ok ? await res.json() : { error: await res.text() }

  return {
    label,
    query:     `GET /rest/v1/${table}?${filter}`,
    result:    data,
    rows:      Array.isArray(data) ? data.length : 0,
    durationMs: Date.now() - t0,
  }
}
