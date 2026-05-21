import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  resolve: {
    alias: {
      '@': r('src/renderer'),
      '@shared': r('src/shared'),
      '@main': r('src/main'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/schema/**/*.test.ts',
      'tests/api/**/*.test.ts',
      'src/renderer/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'out/**'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/main/bridge/**/*.ts',
        'src/main/services/**/*.ts',
        'src/main/ipc/**/*.ts',
        'src/renderer/lib/**/*.ts',
        'src/renderer/modules/**/store.ts',
        'src/renderer/components/**/*.tsx',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/types/**',
        'src/main/drivers/**',
      ],
      thresholds: {
        // Pure domain / services hold the bar high.
        'src/main/bridge/**/*.ts': { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
