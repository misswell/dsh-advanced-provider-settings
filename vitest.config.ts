import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      // The real primitives package is a client ModuleLoader bundle, not a
      // requirable module. Aliasing it to a behavioural double is what lets the
      // browser half's components be rendered with real React in tests at all.
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(
        new URL('./tests/stubs/primitives.tsx', import.meta.url),
      ),
    },
  },
})
