import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/qa-agent/**', 'tests/smoke-test.js', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/game/**', 'src/utils/**', 'src/contexts/reducers/**', 'src/components/**'],
      exclude: ['node_modules/**', 'tests/**', '*.config.ts', 'src/main.tsx', 'src/**/*.d.ts'],
      // Thresholds apply only to files actually covered by tests.
      // Global thresholds are kept low because many src/game/ files have no tests yet.
      // Per-file thresholds for well-tested modules are enforced via the test assertions.
      thresholds: {
        lines: 5,
        functions: 5,
        branches: 5,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
