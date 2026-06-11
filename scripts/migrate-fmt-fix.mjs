/**
 * Fix pass 2: files that either:
 *   A) had a local fmtFCFA function (import not added, hook call added but dangling)
 *   B) have sub-components using fmtFCFA (need useFmt() added to them)
 *
 * Run: node scripts/migrate-fmt-fix.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')
const HOOK_IMPORT = `import { useFmt } from '@/lib/hooks/useFmt'`

function fixFile(relPath, { addImport, removeLocalFn, subComponents }) {
  const filePath = resolve(ROOT, relPath)
  let content = readFileSync(filePath, 'utf-8')
  let modified = false

  // A) Add the missing import if needed
  if (addImport && !content.includes("from '@/lib/hooks/useFmt'")) {
    // Insert right after the last existing @/lib/hooks import, or after first import block
    content = content.replace(
      /(import \{[^}]+\} from '@\/lib\/hooks\/[^']+'\n)/,
      `$1${HOOK_IMPORT}\n`
    )
    if (!content.includes("from '@/lib/hooks/useFmt'")) {
      // Fallback: after 'use client'
      content = content.replace("'use client'\n", `'use client'\n${HOOK_IMPORT}\n`)
    }
    modified = true
  }

  // B) Remove local module-level fmtFCFA function/const
  if (removeLocalFn) {
    // Arrow function: const fmtFCFA = (v: number) => ...  (single line)
    content = content.replace(
      /^const fmtFCFA = \(.*\) => .*\n/m,
      ''
    )
    // Regular function: function fmtFCFA(n: number) { return ... }
    content = content.replace(
      /^function fmtFCFA\(.*\)\s*\{[^}]+\}\n/m,
      ''
    )
    modified = true
  }

  // C) Add useFmt() to specific sub-components (by function name)
  if (subComponents && subComponents.length > 0) {
    for (const fnName of subComponents) {
      // Match "function FnName({...}" or "function FnName(...)" followed by "{"
      const re = new RegExp(
        `(^function ${fnName}\\([^)]*\\)(?:\\s*:\\s*[^{]+)?\\s*\\{)`,
        'm'
      )
      // For "function Name({" (object destructuring — might have newlines)
      // Try simpler: find the line "function FnName(" and the next "{"
      if (!content.includes(`const { fmt: fmtFCFA } = useFmt()`)) {
        // This shouldn't happen since pass 1 already added to default export
        // But just in case, skip
      }

      // More reliable: find the opening brace of the sub-component
      // Strategy: find "function FnName" then find next ") {" and insert after
      const idx = content.indexOf(`function ${fnName}(`)
      if (idx === -1) continue

      // Find the opening brace of the function body
      let braceIdx = content.indexOf(') {', idx)
      if (braceIdx === -1) continue
      braceIdx = braceIdx + 3 // skip ") {"

      const before = content.slice(0, braceIdx)
      const after = content.slice(braceIdx)

      // Only add if not already there in the sub-component scope
      // Check if useFmt is already in the next ~5 lines after the brace
      const nextLines = after.slice(0, 300)
      if (nextLines.includes('useFmt()')) continue

      content = before + '\n  const { fmt: fmtFCFA } = useFmt()' + after
      modified = true
    }
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8')
    console.log('✓', relPath)
  }
}

// ── Files with local module-level fmtFCFA (need import + remove local fn) ─────

const LOCAL_FN_FILES = [
  'app/dashboard/agriculture/intrants/page.tsx',
  'app/dashboard/agriculture/recoltes/page.tsx',
  'app/dashboard/banque/clients/page.tsx',
  'app/dashboard/banque/credits/page.tsx',
  'app/dashboard/banque/epargne/page.tsx',
  'app/dashboard/banque/operations/page.tsx',
  'app/dashboard/boisson/tournees/page.tsx',
  'app/dashboard/btp/chantiers/page.tsx',
  'app/dashboard/btp/page.tsx',
  'app/dashboard/cabinet/projets/page.tsx',
  'app/dashboard/ong/dons/page.tsx',
  'app/dashboard/ong/projets/page.tsx',
  'app/dashboard/rh/analytics/page.tsx',
  'app/dashboard/rh/avantages/page.tsx',
  'app/dashboard/rh/portail/page.tsx',
  'app/dashboard/restaurant/page.tsx',
  'app/dashboard/abonnement/page.tsx',
]

for (const f of LOCAL_FN_FILES) {
  fixFile(f, { addImport: true, removeLocalFn: true })
}

// ── Special cases: rh/page.tsx ────────────────────────────────────────────────
// Has 1114 lines, hook at line 1115 — useFmt import missing
fixFile('app/dashboard/rh/page.tsx', { addImport: true, removeLocalFn: true })

// ── Files with sub-components needing useFmt() ────────────────────────────────

fixFile('app/dashboard/modules/page.tsx', {
  subComponents: ['ModuleCard'],
})

fixFile('app/dashboard/rapports/page.tsx', {
  subComponents: ['Section'],
})

fixFile('app/dashboard/comptabilite/annexes/page.tsx', {
  subComponents: ['TableSolde'],
})

fixFile('app/dashboard/comptabilite/journal/page.tsx', {
  addImport: true,
  removeLocalFn: true,
  subComponents: ['CompteAutocomplete', 'ModalSaisie'],
})

console.log('\nFix pass 2 complete.')
