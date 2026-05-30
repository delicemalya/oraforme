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
  ]),
  {
    rules: {
      // Calling async load() inside useEffect is the standard React data-fetching pattern.
      "react-hooks/set-state-in-effect": "warn",
      // Date.now() in utility functions nested inside components is standard practice.
      "react-hooks/purity": "warn",
      // any types are acceptable in catch blocks and chart tooltips.
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars are warnings, not errors.
      "@typescript-eslint/no-unused-vars": "warn",
      // a11y alt-text is a warning for PDF renderer components (react-pdf Image).
      "jsx-a11y/alt-text": "warn",
      // French text uses apostrophes naturally — too aggressive for francophone content.
      "react/no-unescaped-entities": "off",
      // Components defined inside render are a performance warning, not a crash bug.
      "react-hooks/static-components": "warn",
      // prefer-const is a style preference.
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
