import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
