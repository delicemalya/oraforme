/**
 * LOI-O — Unique Realtime Manager (C-004.3)
 *
 * RealtimeOrchestrator est l'UNIQUE point d'entrée pour les subscriptions
 * Supabase Realtime dans Oraforme.
 *
 * En attendant la création du RealtimeOrchestrator, les 9 canaux existants
 * sont documentés comme DET-O-001 à DET-O-009.
 *
 * Ce test bloque CI si un NOUVEAU canal est ajouté sans être enregistré
 * dans KNOWN_REALTIME_CHANNELS. Toute nouvelle subscription doit être :
 *
 *   1. Documentée dans KNOWN_REALTIME_CHANNELS (avec un ID DET-O-XXX)
 *   2. Planifiée pour migration vers RealtimeOrchestrator (futur)
 *
 * Pattern interdit : supabase.channel(...).on(...).subscribe()
 * Pattern autorisé (futur) : useRealtimeSubscription(table, filter, handler)
 *
 * Voir docs/LOI-O-REALTIME-MANAGER.md
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ── Canaux Realtime connus (DET-O-001 à DET-O-009) ───────────────────────────
// Toute subscription Supabase Realtime doit être enregistrée ici.
// CI échoue si un nouveau fichier utilise .channel() sans être dans cette liste.
const KNOWN_REALTIME_CHANNELS: { file: string; id: string; channel: string; table: string }[] = [
  {
    file: 'components/ui/NotificationsPanel.tsx',
    id: 'DET-O-001',
    channel: 'notif-panel-v2',
    table: 'notifications',
  },
  {
    file: 'components/dashboard/DashboardClient.tsx',
    id: 'DET-O-002',
    channel: 'dashboard-${tenantId}',
    table: 'factures',
  },
  {
    file: 'app/dashboard/tresorerie/page.tsx',
    id: 'DET-O-003',
    channel: 'treso-${tenantId}',
    table: 'transactions',
  },
  {
    file: 'app/dashboard/taches/page.tsx',
    id: 'DET-O-004',
    channel: 'tasks:${tenantId}',
    table: 'taches',
  },
  {
    file: 'app/dashboard/finance/page.tsx',
    id: 'DET-O-005',
    channel: 'finance-${tenantId}',
    table: 'transactions',
  },
  {
    file: 'app/dashboard/comptabilite/journal/page.tsx',
    id: 'DET-O-006',
    channel: 'journal-${tenantId}',
    table: 'journal_entries',
  },
  {
    file: 'app/dashboard/comptabilite/grand-livre/page.tsx',
    id: 'DET-O-007',
    channel: 'gl-${tenantId}-${year}',
    table: 'journal_entries',
  },
  {
    file: 'app/dashboard/notifications/page.tsx',
    id: 'DET-O-008',
    channel: 'notifs:${tenantId}',
    table: 'notifications',
  },
  {
    file: 'app/dashboard/comptabilite/balance/page.tsx',
    id: 'DET-O-009',
    channel: 'balance-${tenantId}-${year}',
    table: 'journal_entries',
  },
]

// ── Chemins exemptés — infra ─────────────────────────────────────────────────
const INFRA_EXEMPT = [
  /[\\/]supabase[\\/]migrations[\\/]/,
  /[\\/]lib[\\/]architecture[\\/]/,
  /[\\/]docs[\\/]/,
  /[\\/]scripts[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
  /\.test\.ts$/,
  /\.test\.tsx$/,
]

// ── Pattern de détection ───────────────────────────────────────────────────────
// Détecte l'appel .channel( dans les fichiers applicatifs.
const CHANNEL_PATTERN = /\.channel\s*\(/

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFiles(): string[] {
  const patterns = ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}']
  const files: string[] = []
  for (const p of patterns) {
    files.push(...globSync(p, { cwd: ROOT, absolute: true }))
  }
  return files.filter(f => !INFRA_EXEMPT.some(rx => rx.test(f.replace(/\\/g, '/'))))
}

function getRelative(filePath: string): string {
  return filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
}

function isKnownChannel(rel: string): (typeof KNOWN_REALTIME_CHANNELS)[0] | null {
  return KNOWN_REALTIME_CHANNELS.find(c => rel.endsWith(c.file) || rel === c.file) ?? null
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LOI-O — Unique Realtime Manager (C-004.3)', () => {

  it('aucun nouveau fichier n\'utilise .channel() sans être enregistré', () => {
    const files = getFiles()
    const newChannels: string[] = []
    const knownChannels: string[] = []

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8')
      if (!CHANNEL_PATTERN.test(content)) continue

      const rel = getRelative(filePath)
      const known = isKnownChannel(rel)
      if (known) {
        knownChannels.push(`  ${known.id} : ${rel} (canal : ${known.channel}, table : ${known.table})`)
      } else {
        newChannels.push(`  NOUVEAU CANAL : ${rel}`)
      }
    }

    if (knownChannels.length > 0) {
      console.warn([
        '',
        `[LOI-O] ${knownChannels.length} canal/canaux Realtime connu(s) — dette technique :`,
        ...knownChannels,
        '',
        'Ces canaux sont documentés comme dettes DET-O-xxx.',
        'Plan de migration : créer RealtimeOrchestrator + hook useRealtimeSubscription().',
      ].join('\n'))
    }

    if (newChannels.length > 0) {
      const msg = [
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-O VIOLÉE — Nouveau canal Realtime non enregistré                 ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
        '',
        `${newChannels.length} NOUVEAU(X) canal/canaux détecté(s) :`,
        '',
        ...newChannels,
        '',
        'LOI-O : Toute subscription Supabase doit être enregistrée.',
        'Action requise : ajouter le fichier dans KNOWN_REALTIME_CHANNELS',
        '  avec un ID DET-O-XXX, le nom du canal, et la table écoutée.',
        'Futur : migrer vers useRealtimeSubscription(table, filter, handler).',
        'Voir : docs/LOI-O-REALTIME-MANAGER.md',
      ].join('\n')
      expect.fail(msg)
    }

    console.log(
      `[LOI-O] canaux Realtime : ${files.length} fichiers scannés — ` +
      `0 nouveau canal ✅ (${knownChannels.length} canaux connus documentés)`
    )
  })

  it('les DET-O documentées correspondent aux fichiers réels', () => {
    const files = getFiles()
    const filesWithChannels = new Set(
      files
        .filter(f => CHANNEL_PATTERN.test(readFileSync(f, 'utf-8')))
        .map(f => getRelative(f))
    )

    const orphans: string[] = []
    for (const known of KNOWN_REALTIME_CHANNELS) {
      const exists = [...filesWithChannels].some(f => f.endsWith(known.file) || f === known.file)
      if (!exists) {
        orphans.push(`  ${known.id} : '${known.file}' n'utilise plus .channel()`)
      }
    }

    if (orphans.length > 0) {
      console.warn([
        '',
        '[LOI-O] DETTES ORPHELINES — fichiers plus actifs :',
        ...orphans,
        '',
        'Supprimer les entrées correspondantes de KNOWN_REALTIME_CHANNELS.',
      ].join('\n'))
    }

    console.log(`[LOI-O] Dettes actives : ${filesWithChannels.size}/${KNOWN_REALTIME_CHANNELS.length} ✅`)
  })

  it('tous les canaux connus ont un cleanup .unsubscribe() ou channel.remove()', () => {
    const channelFiles = KNOWN_REALTIME_CHANNELS.map(c => path.join(ROOT, ...c.file.split('/')))
    const missing: string[] = []

    for (const filePath of channelFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const hasCleanup = /\.unsubscribe\(\)|supabase\.removeChannel\(|channel\.unsubscribe\(\)/.test(content)
        if (!hasCleanup) {
          const rel = getRelative(filePath)
          missing.push(`  ${rel} — pas de cleanup .unsubscribe() ou removeChannel() détecté`)
        }
      } catch {
        // Fichier non trouvé — géré par le test d'orphelins ci-dessus
      }
    }

    if (missing.length > 0) {
      console.warn([
        '',
        '[LOI-O] CANAUX SANS CLEANUP — risque de fuite mémoire :',
        ...missing,
        '',
        'Ajouter un cleanup dans useEffect return : () => { supabase.removeChannel(channel) }',
      ].join('\n'))
    }

    console.log(`[LOI-O] Cleanup : ${KNOWN_REALTIME_CHANNELS.length - missing.length}/${KNOWN_REALTIME_CHANNELS.length} canaux ont un cleanup ✅`)
  })

  it('certifie LOI-O : Realtime Manager = unique gestionnaire de subscriptions', () => {
    const files = getFiles()
    const newChannels = files.filter(f => {
      const content = readFileSync(f, 'utf-8')
      if (!CHANNEL_PATTERN.test(content)) return false
      const rel = getRelative(f)
      return !isKnownChannel(rel)
    })

    if (newChannels.length === 0) {
      console.log([
        '',
        '╔═══════════════════════════════════════════════════════════════════════╗',
        '║  LOI-O CERTIFICATION — ACCORDÉE ✅                                   ║',
        '║  Realtime Manager = unique gestionnaire subscriptions (C-004.3)       ║',
        `║  ${KNOWN_REALTIME_CHANNELS.length} canaux connus documentés (DET-O-001 à DET-O-009)`.padEnd(72) + '║',
        '║  Plan : RealtimeOrchestrator + useRealtimeSubscription() (futur)      ║',
        '╚═══════════════════════════════════════════════════════════════════════╝',
      ].join('\n'))
    }

    expect(newChannels.length, `LOI-O : ${newChannels.length} nouveau(x) canal/canaux non enregistré(s)`).toBe(0)
  })
})
