/**
 * Pass 3: Fix remaining pages/components with hardcoded FCFA
 * Targets: BiCharts, crm, cabinet/clients, hotel, recouvrement,
 *          restaurant/direction, sante/direction, finance, ecole pages
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
let changed = 0, skipped = 0

function fix(relPath, transforms) {
  const path = join(root, relPath)
  let src
  try { src = readFileSync(path, 'utf8') } catch { console.log(`✗ not found: ${relPath}`); skipped++; return }
  const original = src
  for (const [from, to] of transforms) {
    if (from instanceof RegExp) {
      src = src.replace(from, to)
    } else {
      // string replace — replace ALL occurrences
      src = src.split(from).join(to)
    }
  }
  if (src !== original) {
    writeFileSync(path, src, 'utf8')
    console.log(`✓ ${relPath}`)
    changed++
  } else {
    console.log(`⚠  no change: ${relPath}`)
    skipped++
  }
}

// ─── 1. BiCharts.tsx ─────────────────────────────────────────────────────────
fix('components/bi/BiCharts.tsx', [
  // Add useFmt import after recharts import block
  [
    `} from 'recharts'\n\n// ── Theme presets`,
    `} from 'recharts'\nimport { useFmt } from '@/lib/hooks/useFmt'\n\n// ── Theme presets`,
  ],
  // Replace all 3 identical `const fmt = formatter ?? ...` (BiTrendChart, BiBarChart, BiComposedChart)
  [
    `const fmt = formatter ?? ((v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA')`,
    `const { fmt: fmtHook } = useFmt()\n  const fmt = formatter ?? fmtHook`,
  ],
])

// ─── 2. crm/page.tsx ─────────────────────────────────────────────────────────
fix('app/dashboard/crm/page.tsx', [
  // Add import
  [
    `import { supabase } from '@/lib/supabase'\nimport { useTenantContext }`,
    `import { supabase } from '@/lib/supabase'\nimport { useFmt } from '@/lib/hooks/useFmt'\nimport { useTenantContext }`,
  ],
  // Remove module-level fmt function (handles nullable)
  [
    `function fmt(n?: number | null) {\n  if (!n) return '0 FCFA'\n  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'\n}\n`,
    '',
  ],
  // Add hook inside CRMPage
  [
    `export default function CRMPage() {\n`,
    `export default function CRMPage() {\n  const { fmt: _fmt } = useFmt()\n  const fmt = (n?: number | null) => _fmt(n ?? 0)\n`,
  ],
])

// ─── 3. cabinet/clients/page.tsx ─────────────────────────────────────────────
fix('app/dashboard/cabinet/clients/page.tsx', [
  [
    `import { supabase } from '@/lib/supabase'\nimport { useTenantContext }`,
    `import { supabase } from '@/lib/supabase'\nimport { useFmt } from '@/lib/hooks/useFmt'\nimport { useTenantContext }`,
  ],
  [
    `function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA' }\n`,
    '',
  ],
  [
    `export default function CabinetClientsPage() {\n`,
    `export default function CabinetClientsPage() {\n  const { fmt } = useFmt()\n`,
  ],
])

// ─── 4. cabinet/clients/[id]/page.tsx ────────────────────────────────────────
fix('app/dashboard/cabinet/clients/[id]/page.tsx', [
  [
    `import { supabase } from '@/lib/supabase'\nimport { useTenantContext }`,
    `import { supabase } from '@/lib/supabase'\nimport { useFmt } from '@/lib/hooks/useFmt'\nimport { useTenantContext }`,
  ],
  [
    `function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA' }\n`,
    '',
  ],
  [
    `export default function ClientDetailPage() {\n`,
    `export default function ClientDetailPage() {\n  const { fmt } = useFmt()\n`,
  ],
])

// ─── 5. hotel/page.tsx ───────────────────────────────────────────────────────
fix('app/dashboard/hotel/page.tsx', [
  [
    `import { useTenantContext } from '@/lib/contexts/TenantContext'\n`,
    `import { useTenantContext } from '@/lib/contexts/TenantContext'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  [
    `function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA' }\n`,
    '',
  ],
  [
    `export default function HotelDashboard() {\n`,
    `export default function HotelDashboard() {\n  const { fmt } = useFmt()\n`,
  ],
])

// ─── 6. recouvrement/page.tsx ────────────────────────────────────────────────
fix('app/dashboard/recouvrement/page.tsx', [
  [
    `import { supabase } from '@/lib/supabase'\nimport { useTenantContext }`,
    `import { supabase } from '@/lib/supabase'\nimport { useFmt } from '@/lib/hooks/useFmt'\nimport { useTenantContext }`,
  ],
  [
    `function fmt(n?: number | null) {\n  if (!n) return '0 FCFA'\n  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'\n}\n`,
    '',
  ],
  [
    `export default function RecouvrementPage() {\n`,
    `export default function RecouvrementPage() {\n  const { fmt: _fmt } = useFmt()\n  const fmt = (n?: number | null) => _fmt(n ?? 0)\n`,
  ],
])

// ─── 7. restaurant/direction/page.tsx ────────────────────────────────────────
fix('app/dashboard/restaurant/direction/page.tsx', [
  [
    `import { useState, useEffect } from 'react'\n`,
    `import { useState, useEffect } from 'react'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  // Add hook inside component (after maxCA const)
  [
    `export default function DirectionRestaurantPage() {\n`,
    `export default function DirectionRestaurantPage() {\n  const { fmt: fmtCurrency, devise } = useFmt()\n`,
  ],
  // KPI val replacements
  [`fmtNum(kpis.ca_aujourd) + ' FCFA'`,     `fmtCurrency(kpis.ca_aujourd)`],
  [`fmtNum(kpis.ca_semaine) + ' FCFA'`,     `fmtCurrency(kpis.ca_semaine)`],
  [`fmtNum(kpis.ca_mois) + ' FCFA'`,        `fmtCurrency(kpis.ca_mois)`],
  [`fmtNum(kpis.resultat_mois) + ' FCFA'`,  `fmtCurrency(kpis.resultat_mois)`],
  [`fmtNum(kpis.ticket_moyen) + ' FCFA'`,   `fmtCurrency(kpis.ticket_moyen)`],
  // Payment amounts (val as number in Paiements section)
  [`{fmtNum(val as number)}`,               `{fmtCurrency(val as number)}`],
  // Rentabilité table prices/costs/margins
  [`{fmtNum(r.prix)}`,                      `{fmtCurrency(r.prix)}`],
  [`{fmtNum(r.cout)}`,                      `{fmtCurrency(r.cout)}`],
  [`{fmtNum(r.marge)}`,                     `{fmtCurrency(r.marge)}`],
  // Column header
  [`'Marge FCFA'`,                          `\`Marge \${devise}\``],
])

// ─── 8. sante/direction/page.tsx ─────────────────────────────────────────────
fix('app/dashboard/sante/direction/page.tsx', [
  [
    `import { useState, useEffect } from 'react'\n`,
    `import { useState, useEffect } from 'react'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  [
    `export default function DirectionSantePage() {\n`,
    `export default function DirectionSantePage() {\n  const { fmt: fmtCurrency, devise } = useFmt()\n`,
  ],
  [`fmtNum(kpis.ca_consultations_mois) + ' FCFA'`, `fmtCurrency(kpis.ca_consultations_mois)`],
  // Factures impayées block
  [
    `<p className="text-[28px] font-black text-[#DC2626]">{fmtNum(kpis.factures_impayees)}</p>\n              <p className="text-[11px] text-[#64748B]">FCFA en attente de règlement</p>`,
    `<p className="text-[28px] font-black text-[#DC2626]">{fmtCurrency(kpis.factures_impayees)}</p>\n              <p className="text-[11px] text-[#64748B]">{devise} en attente de règlement</p>`,
  ],
])

// ─── 9. finance/page.tsx ─────────────────────────────────────────────────────
fix('app/dashboard/finance/page.tsx', [
  // Add import
  [
    `import { useLocale } from '@/lib/hooks/useLocale'\n`,
    `import { useLocale } from '@/lib/hooks/useLocale'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  // Remove module-level fmt (hardcodes FCFA)
  [
    `const fmt = (n: number) =>\n  new Intl.NumberFormat('fr-CG', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' FCFA'\n\n`,
    '',
  ],
  // Rename module-level fmtShort → fmtShortNum (pure number, for chart axes)
  [
    `const fmtShort = (n: number): string => {`,
    `const fmtShortNum = (n: number): string => {`,
  ],
  // Add useFmt inside FinancePage (fmtShort now reactive via hook)
  [
    `export default function FinancePage() {\n`,
    `export default function FinancePage() {\n  const { fmt, fmtShort } = useFmt()\n`,
  ],
  // Chart axes: keep pure number formatter
  [`tickFormatter={fmtShort}`,   `tickFormatter={fmtShortNum}`],
  // Strip ' FCFA' suffix from fmtShort calls (useFmt version already includes currency)
  [` + ' FCFA'}`,                `}`],
  // Inline JSX: `{fmtShort(...)} FCFA`
  [`)} FCFA</span>`,             `)}</span>`],
])

// ─── 10. ecole/direction/page.tsx ─────────────────────────────────────────────
fix('app/dashboard/ecole/direction/page.tsx', [
  // Add useFmt import
  [
    `import { useLocale } from '@/lib/hooks/useLocale'\n`,
    `import { useLocale } from '@/lib/hooks/useLocale'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  // The export default function — find opening and inject hook
  // (ecole/direction uses sub-components; inject into the main default export)
  [
    /export default function (\w+)\(\) \{/,
    (_, name) => `export default function ${name}() {\n  const { fmt: fmtCurrency } = useFmt()`,
  ],
  // Replace fmt(n) + ' FCFA' patterns
  [`fmt(revenuMois) + ' FCFA'`,                       `fmtCurrency(revenuMois)`],
  [`fmt(revenuAnnee) + ' FCFA'`,                      `fmtCurrency(revenuAnnee)`],
  [`fmt(totalPaye) + ' FCFA'`,                        `fmtCurrency(totalPaye)`],
  [`fmt(totalPaye / paiements.length) + ' FCFA'`,     `fmtCurrency(totalPaye / paiements.length)`],
  [`fmt(total) + ' FCFA'`,                            `fmtCurrency(total)`],
  // Inline JSX: {fmt(n)} FCFA
  [`{fmt(p.montant)} FCFA`,                           `{fmtCurrency(p.montant)}`],
  [`{fmt(amount)} FCFA ({pct`,                        `{fmtCurrency(amount)} ({pct`],
  [`{fmt(p.montant)} FCFA`,                           `{fmtCurrency(p.montant)}`],
  [`{fmt(b.montant)} FCFA`,                           `{fmtCurrency(b.montant)}`],
])

// ─── 11. ecole/comptabilite/page.tsx ──────────────────────────────────────────
fix('app/dashboard/ecole/comptabilite/page.tsx', [
  [
    `import { useLocale } from '@/lib/hooks/useLocale'\n`,
    `import { useLocale } from '@/lib/hooks/useLocale'\nimport { useFmt } from '@/lib/hooks/useFmt'\n`,
  ],
  [
    /export default function (\w+)\(\) \{/,
    (_, name) => `export default function ${name}() {\n  const { fmt: fmtCurrency } = useFmt()`,
  ],
  // KpiCard value props
  [`fmt(totalRecettes) + ' FCFA'`,          `fmtCurrency(totalRecettes)`],
  [`fmt(totalDepenses) + ' FCFA'`,          `fmtCurrency(totalDepenses)`],
  [`fmt(Math.abs(solde)) + ' FCFA'`,        `fmtCurrency(Math.abs(solde))`],
  [`fmt(recettes) + ' FCFA'`,               `fmtCurrency(recettes)`],
  [`fmt(depenses) + ' FCFA'`,               `fmtCurrency(depenses)`],
  [`fmt(Math.abs(resultat)) + ' FCFA'`,     `fmtCurrency(Math.abs(resultat))`],
  [`fmt(totalHonoraires) + ' FCFA'` ,       `fmtCurrency(totalHonoraires)`],  // if present
  // Account KpiCard values
  [`fmt(account.totalDepenses) + ' FCFA'`,  `fmtCurrency(account.totalDepenses)`],
  [`fmt(account.totalRecettes) + ' FCFA'`,  `fmtCurrency(account.totalRecettes)`],
  [`fmt(Math.abs(account.solde)) + ' FCFA'`,`fmtCurrency(Math.abs(account.solde))`],
  // Inline JSX: {fmt(n)} FCFA
  [`{fmt(entry.montant_ht)}`,               `{fmtCurrency(entry.montant_ht)}`],
  // TTC display: fmt(...) FCFA
  [`{fmt(entry.montant_ttc)} FCFA`,         `{fmtCurrency(entry.montant_ttc)}`],
  [`{fmt(amount)} FCFA`,                    `{fmtCurrency(amount)}`],
  [`{fmt(recettes)} FCFA`,                  `{fmtCurrency(recettes)}`],
  [`{fmt(depenses)} FCFA`,                  `{fmtCurrency(depenses)}`],
  // Inline text node: '...' FCFA
  [`{fmt(Math.abs(resultat))} FCFA`,        `{fmtCurrency(Math.abs(resultat))}`],
  // Label in FI input
  [`"Montant HT (FCFA) *"`,                `"Montant HT *"`],
  // TTC preview: fmt(...) FCFA
  [/TTC : \{fmt\(([^)]+)\)\} FCFA/g,       (_, expr) => `TTC : {fmtCurrency(${expr})}`],
  // Account detail KpiCards already handled above
  // Entry table debit/credit
  [`{fmt(entry.montant_ttc)}</span>`,       `{fmtCurrency(entry.montant_ttc)}</span>`],
  // k abbreviation – keep plain fmt for abbreviated values
  // line: {a.solde >= 0 ? '+' : ''}{fmt(a.solde / 1000)}k  — leave as-is (abbreviated, not FCFA)
  [`{fmt(k.val)} FCFA`,                     `{fmtCurrency(k.val)}`],
])

console.log(`\nDone: ${changed} files updated, ${skipped} skipped.`)
