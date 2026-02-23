import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/score-cutter/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/core/**/*.ts',
        'src/workers/**/*.ts',
        'src/context/**/*.ts',
        'src/context/**/*.tsx',
      ],
      exclude: ['src/**/__tests__/**', 'src/workers/workerProtocol.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      reporter: ['text', 'text-summary'],
    },
  },
})
