import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include:     ['lib/**/*.test.ts', '__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include:  [
        'lib/fiscal/universal-tax-engine.ts',
        'lib/payroll/universal-payroll-engine.ts',
        'lib/conventions/convention-engine.ts',
        'lib/conventions/types.ts',
        'lib/countries/**/*.ts',
        // C-001.1 — Identity Core Observability
        'lib/identity/auth-logger.ts',
        'lib/identity/auth-trace.ts',
        'lib/identity/auth-metrics.ts',
        'lib/identity/health.ts',
        'lib/identity/types.ts',
      ],
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
