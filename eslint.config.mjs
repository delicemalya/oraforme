import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── LOI-K inline plugin — Unique Writer Law (C-004.2) ─────────────────────────
// Règle avec son propre namespace pour éviter tout conflit avec no-restricted-syntax.
const loiKPlugin = {
  rules: {
    "unique-writer": {
      meta: {
        type: "problem",
        messages: {
          journalEntriesInsert:
            "[LOI-K] INSERT/UPSERT direct dans journal_entries interdit. Utiliser supabase.rpc('emit_accounting_event'). Voir docs/LOI-K-UNIQUE-WRITER.md",
          journalEntriesUpdate:
            "[LOI-K] UPDATE direct dans journal_entries interdit. Le moteur comptable gère via extourne. Voir docs/LOI-K-UNIQUE-WRITER.md",
          journalEntriesDelete:
            "[LOI-K] DELETE direct dans journal_entries interdit. Utiliser supabase.rpc('fn_reverse_accounting_event'). Voir docs/LOI-K-UNIQUE-WRITER.md",
          accountingEventsWrite:
            "[LOI-K] Écriture directe dans accounting_events interdit. La queue est gérée exclusivement par emit_accounting_event(). Voir docs/LOI-K-UNIQUE-WRITER.md",
        },
      },
      create(context) {
        function extractTableMethod(node) {
          if (node.type !== "CallExpression") return null;
          const { callee } = node;
          if (callee.type !== "MemberExpression") return null;
          const obj = callee.object;
          const method = callee.property.name;
          if (
            obj.type === "CallExpression" &&
            obj.callee.type === "MemberExpression" &&
            obj.callee.property.name === "from" &&
            obj.arguments.length > 0 &&
            obj.arguments[0].type === "Literal" &&
            typeof obj.arguments[0].value === "string"
          ) {
            return { table: obj.arguments[0].value, method };
          }
          return null;
        }
        return {
          CallExpression(node) {
            const info = extractTableMethod(node);
            if (!info) return;
            const { table, method } = info;
            if (table === "journal_entries") {
              if (method === "insert" || method === "upsert")
                context.report({ node, messageId: "journalEntriesInsert" });
              else if (method === "update")
                context.report({ node, messageId: "journalEntriesUpdate" });
              else if (method === "delete")
                context.report({ node, messageId: "journalEntriesDelete" });
            } else if (table === "accounting_events") {
              if (method === "insert" || method === "update" || method === "delete")
                context.report({ node, messageId: "accountingEventsWrite" });
            }
          },
        };
      },
    },
  },
};

// ── LOI-L inline plugin — Unique Fiscal Calculator (C-004.3) ─────────────────
const loiLPlugin = {
  rules: {
    "unique-fiscal-calculator": {
      meta: {
        type: "problem",
        messages: {
          hardcodedFiscalRate:
            "[LOI-L] Taux fiscal codé en dur interdit. Utiliser calculerTVA() de usePays() (UI) ou lib/fiscal/universal-tax-engine.ts (serveur). Voir docs/LOI-L-FISCAL-CALCULATOR.md",
        },
      },
      create(context) {
        // TVA rates in CEMAC zone — any multiplication by these in app code is a violation
        const FISCAL_RATES = new Set([0.18, 0.175, 0.19, 0.16, 0.15]);
        return {
          BinaryExpression(node) {
            if (node.operator !== "*") return;
            const checkLiteral = (lit) => {
              if (lit.type === "Literal" && typeof lit.value === "number" && FISCAL_RATES.has(lit.value)) {
                context.report({ node, messageId: "hardcodedFiscalRate" });
              }
            };
            checkLiteral(node.right);
            checkLiteral(node.left);
          },
        };
      },
    },
  },
};

// ── LOI-M inline plugin — Unique Tenant Creator (C-004.3) ────────────────────
const loiMPlugin = {
  rules: {
    "unique-tenant-creator": {
      meta: {
        type: "problem",
        messages: {
          tenantWrite:
            "[LOI-M] Écriture directe dans tenants interdite depuis les composants. Utiliser app/onboarding ou app/api/admin. Voir docs/LOI-M-TENANT-CREATOR.md",
        },
      },
      create(context) {
        function extractTableMethod(node) {
          if (node.type !== "CallExpression") return null;
          const { callee } = node;
          if (callee.type !== "MemberExpression") return null;
          const obj = callee.object;
          const method = callee.property.name;
          if (
            obj.type === "CallExpression" &&
            obj.callee.type === "MemberExpression" &&
            obj.callee.property.name === "from" &&
            obj.arguments.length > 0 &&
            obj.arguments[0].type === "Literal" &&
            typeof obj.arguments[0].value === "string"
          ) {
            return { table: obj.arguments[0].value, method };
          }
          return null;
        }
        return {
          CallExpression(node) {
            const info = extractTableMethod(node);
            if (!info) return;
            if (info.table === "tenants" && ["insert", "update", "upsert"].includes(info.method)) {
              context.report({ node, messageId: "tenantWrite" });
            }
          },
        };
      },
    },
  },
};

// ── LOI-N inline plugin — Unique Permission Engine (C-004.3) ─────────────────
const loiNPlugin = {
  rules: {
    "unique-permission-engine": {
      meta: {
        type: "problem",
        messages: {
          rawRoleCheck:
            "[LOI-N] Comparaison de rôle directe interdite. Utiliser usePermissions().isOwner, isAdmin, ou can(). Voir docs/LOI-N-PERMISSION-ENGINE.md",
        },
      },
      create(context) {
        // Permission roles — not AI message roles ('user', 'assistant', 'bot', 'system')
        const PERMISSION_ROLES = new Set([
          "owner", "admin", "manager", "accountant",
          "finance", "membre", "staff", "directeur",
        ]);
        return {
          BinaryExpression(node) {
            if (node.operator !== "===" && node.operator !== "!==") return;
            const checkSide = (side, other) => {
              if (
                side.type === "MemberExpression" &&
                side.property.type === "Identifier" &&
                side.property.name === "role" &&
                other.type === "Literal" &&
                typeof other.value === "string" &&
                PERMISSION_ROLES.has(other.value)
              ) {
                context.report({ node, messageId: "rawRoleCheck" });
              }
            };
            checkSide(node.left, node.right);
            checkSide(node.right, node.left);
          },
        };
      },
    },
  },
};

// ── LOI-O inline plugin — Unique Realtime Manager (C-004.3) ──────────────────
const loiOPlugin = {
  rules: {
    "unique-realtime-manager": {
      meta: {
        type: "suggestion",
        messages: {
          directChannel:
            "[LOI-O] Subscription Realtime directe — enregistrer ce fichier dans KNOWN_REALTIME_CHANNELS (loi-o-realtime-manager.test.ts) et planifier la migration vers RealtimeOrchestrator. Voir docs/LOI-O-REALTIME-MANAGER.md",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            const { callee } = node;
            if (
              callee.type === "MemberExpression" &&
              callee.property.type === "Identifier" &&
              callee.property.name === "channel"
            ) {
              context.report({ node, messageId: "directChannel" });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Utility scripts — CJS/old-style, not app code
    "scripts/**",
  ]),
  // ── LOI-K — Unique Writer Law (C-004.2) ─────────────────────────────────────
  // Règle loi-k/unique-writer — namespace propre, ne conflicte pas avec no-restricted-syntax.
  // Voir docs/LOI-K-UNIQUE-WRITER.md
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.ts",
    ],
    ignores: [
      "app/dashboard/comptabilite/**",   // EXM-JE-001 : saisie manuelle intentionnelle
      "lib/accounting-engine.ts",        // EXM-JE-002 : helper serveur (à migrer)
      "lib/compta-sync-client.ts",       // EXM-JE-003 : dette technique legacy
      "lib/architecture/**",
    ],
    plugins: { "loi-k": loiKPlugin },
    rules: {
      "loi-k/unique-writer": "error",
    },
  },
  // ── LOI-L — Unique Fiscal Calculator (C-004.3) ──────────────────────────────
  // Interdit les calculs TVA/IS/CNSS avec taux hardcodés dans les composants.
  // Chemin autorisé : calculerTVA() de usePays() ou lib/fiscal/universal-tax-engine.ts
  // Voir docs/LOI-L-FISCAL-CALCULATOR.md
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
    ],
    ignores: [
      "lib/fiscal/**",
      "lib/fiscalite/**",
      "lib/countries/**",
      "lib/contexts/PaysContext.tsx",
      "lib/architecture/**",
    ],
    plugins: { "loi-l": loiLPlugin },
    rules: {
      "loi-l/unique-fiscal-calculator": "error",
    },
  },
  // ── LOI-M — Unique Tenant Creator (C-004.3) ──────────────────────────────────
  // Interdit l'écriture directe dans tenants depuis les composants dashboard.
  // Chemins autorisés : app/onboarding, app/api/admin
  // Voir docs/LOI-M-TENANT-CREATOR.md
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "components/dashboard/**/*.{ts,tsx}",
    ],
    ignores: [
      // DET-M-001 : Group management — à migrer vers app/api/admin/groupe
      "app/dashboard/groupe/**",
      "lib/architecture/**",
    ],
    plugins: { "loi-m": loiMPlugin },
    rules: {
      "loi-m/unique-tenant-creator": "error",
    },
  },
  // ── LOI-N — Unique Permission Engine (C-004.3) ───────────────────────────────
  // Interdit les comparaisons profile.role === 'owner' hors du Permission Core.
  // Chemin autorisé : const { isOwner, isAdmin } = usePermissions()
  // Voir docs/LOI-N-PERMISSION-ENGINE.md
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "components/dashboard/**/*.{ts,tsx}",
    ],
    ignores: [
      // Pages admin — affichent les rôles bruts pour monitoring
      "app/admin/**",
      // Gestion d'équipe — gère les rôles des membres
      "app/dashboard/equipe/**",
      // DET-N-001 : dashboard root page — fallback isFinancial
      "app/dashboard/page.tsx",
      // DET-N-002/003 : ecole pages — ecoleRole mapping
      "app/dashboard/ecole/**",
      "lib/architecture/**",
    ],
    plugins: { "loi-n": loiNPlugin },
    rules: {
      "loi-n/unique-permission-engine": "error",
    },
  },
  // ── LOI-O — Unique Realtime Manager (C-004.3) ────────────────────────────────
  // Avertit dès qu'un nouveau canal Realtime est créé sans être enregistré.
  // Règle "warn" car les 9 canaux existants sont des dettes DET-O-001 à DET-O-009.
  // Voir docs/LOI-O-REALTIME-MANAGER.md
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
    ],
    ignores: [
      "lib/architecture/**",
    ],
    plugins: { "loi-o": loiOPlugin },
    rules: {
      // "warn" car les 9 canaux existants sont connus — CI gate via Vitest LOI-O
      "loi-o/unique-realtime-manager": "warn",
    },
  },
  // ── CACHE READ FORBIDDEN — F-003 Architecture Rule ──────────────────────────
  // Cache columns on the tenants table (modules_actifs, plan for gating,
  // cache_*, snapshot_*, legacy_* patterns) must never be read in business
  // components for access control. Only tenant_modules is the source of truth.
  // Admin pages (app/admin/**) are excluded — they may read cache for analytics.
  // See docs/CACHE_READ_FORBIDDEN.md for the full rule.
  {
    files: [
      "app/dashboard/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "components/dashboard/**/*.{ts,tsx}",
      "components/ui/**/*.{ts,tsx}",
      "lib/**/*.ts",
    ],
    ignores: [
      // Admin analytics — allowed to read cache columns for reporting
      "app/admin/**",
      "app/api/admin/**",
      // Toggle route — writes modules_actifs as cache sync (not a read for gating)
      "app/api/modules/toggle/**",
      // Onboarding — writes modules_actifs on tenant creation
      "app/onboarding/**",
      // Architecture tests themselves
      "lib/architecture/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Forbid selecting modules_actifs from DB (covers both quote styles)
        {
          selector: "Literal[value='modules_actifs']",
          message: "[CACHE READ FORBIDDEN] Never read tenants.modules_actifs — use tenant_modules table or TenantContext.modulesActifs. See docs/CACHE_READ_FORBIDDEN.md",
        },
        {
          selector: "TemplateElement[value.raw=/modules_actifs/]",
          message: "[CACHE READ FORBIDDEN] Never read tenants.modules_actifs in template literals — use tenant_modules table. See docs/CACHE_READ_FORBIDDEN.md",
        },
        // Forbid cache_*, snapshot_*, legacy_* column names in selects
        {
          selector: "Literal[value=/\\bcache_/]",
          message: "[CACHE READ FORBIDDEN] cache_* columns on tenants are denormalized cache. See docs/CACHE_READ_FORBIDDEN.md",
        },
        {
          selector: "Literal[value=/\\blegacy_/]",
          message: "[CACHE READ FORBIDDEN] legacy_* columns on tenants are deprecated. See docs/CACHE_READ_FORBIDDEN.md",
        },
      ],
    },
  },
  {
    rules: {
      // Calling async load() inside useEffect is the standard React data-fetching pattern.
      "react-hooks/set-state-in-effect": "off",
      // Date.now() in render for relative-time display is standard practice.
      "react-hooks/purity": "off",
      // any types are acceptable in catch blocks, Supabase casts, and chart tooltips.
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars are warnings, not errors. Underscore-prefix suppresses intentionally unused params.
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
      }],
      // a11y alt-text: react-pdf Image components don't accept alt props.
      "jsx-a11y/alt-text": "off",
      // French text uses apostrophes naturally — too aggressive for francophone content.
      "react/no-unescaped-entities": "off",
      // Components defined inside render: documented performance trade-off in this codebase.
      "react-hooks/static-components": "off",
      // next/image imposes strict width/height requirements incompatible with dynamic avatar URLs.
      "@next/next/no-img-element": "off",
      // prefer-const is a style preference.
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
