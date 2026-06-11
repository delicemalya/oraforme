/**
 * Migrates all dashboard pages from fmtFCFA/fmtShortFCFA (static) to useFmt() hook (reactive).
 *
 * Run: node scripts/migrate-fmt.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve('.')
const HOOK_IMPORT = `import { useFmt } from '@/lib/hooks/useFmt'`

function getAllTsxFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) results.push(...getAllTsxFiles(full))
    else if (entry.endsWith('.tsx')) results.push(full)
  }
  return results
}

function processFile(filePath) {
  const original = readFileSync(filePath, 'utf-8')

  // Skip if already migrated
  if (original.includes('useFmt()') || original.includes("from '@/lib/hooks/useFmt'")) return false

  // Determine what needs removing
  const usesFmtFCFA     = original.includes('fmtFCFA')
  const usesFmtShortFCFA = original.includes('fmtShortFCFA')
  if (!usesFmtFCFA && !usesFmtShortFCFA) return false

  let content = original

  // ── 1. Fix import from @/lib/admin-config ───────────────────────────────────
  // Case A: sole import
  content = content.replace(
    /^import \{ fmtFCFA \} from '@\/lib\/admin-config'$/m,
    HOOK_IMPORT
  )
  // Case B: fmtFCFA mixed with other exports
  content = content.replace(
    /^(import \{[^}]*),\s*fmtFCFA(\s*\} from '@\/lib\/admin-config')$/m,
    (_, before, after) => `${before}${after}\n${HOOK_IMPORT}`
  )
  content = content.replace(
    /^(import \{)\s*fmtFCFA,\s*([^}]*\} from '@\/lib\/admin-config')$/m,
    (_, open, rest) => `${open} ${rest}\n${HOOK_IMPORT}`
  )

  // ── 2. Fix import from @/lib/analytics/formatters ───────────────────────────
  // Strip fmtFCFA and/or fmtShortFCFA from the import, keep fmtPct/growthPct etc.
  content = content.replace(
    /^import \{([^}]+)\} from '@\/lib\/analytics\/formatters'$/m,
    (_, exports) => {
      const names = exports.split(',').map(s => s.trim())
      const keep = names.filter(n => n !== 'fmtFCFA' && n !== 'fmtShortFCFA')
      const line = keep.length > 0
        ? `import { ${keep.join(', ')} } from '@/lib/analytics/formatters'`
        : ''
      const hookLine = (names.includes('fmtFCFA') || names.includes('fmtShortFCFA'))
        ? HOOK_IMPORT
        : ''
      return [line, hookLine].filter(Boolean).join('\n')
    }
  )

  // ── 3. Insert hook call inside the export default function body ───────────────
  const hookCall = usesFmtShortFCFA
    ? '  const { fmt: fmtFCFA, fmtShort: fmtShortFCFA } = useFmt()'
    : '  const { fmt: fmtFCFA } = useFmt()'

  // Match: export default function Name(anything) { on a SINGLE line
  content = content.replace(
    /^(export default function \w+\([^)]*\) \{)$/m,
    (match) => `${match}\n${hookCall}`
  )

  if (content === original) return false

  writeFileSync(filePath, content, 'utf-8')
  return true
}

const dashboardDir = join(ROOT, 'app', 'dashboard')
const files = getAllTsxFiles(dashboardDir)

let updated = 0
let skipped = 0

for (const f of files) {
  const changed = processFile(f)
  if (changed) {
    updated++
    console.log('✓', f.replace(ROOT, '.'))
  } else {
    skipped++
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} unchanged`)
