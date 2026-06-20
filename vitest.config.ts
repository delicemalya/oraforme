import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include:     ['lib/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include:  [
        'lib/fiscal/universal-tax-engine.ts',
        'lib/payroll/universal-payroll-engine.ts',
        'lib/conventions/convention-engine.ts',
        'lib/conventions/types.ts',
        'lib/countries/**/*.ts',
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
