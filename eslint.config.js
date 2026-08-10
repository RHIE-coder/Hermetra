import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Flat config (eslint 10). Layered like the app itself: one block per process
// boundary, because the available globals differ per boundary — main is Node,
// renderer is the browser sandbox with no nodeIntegration.
export default tseslint.config(
  {
    ignores: [
      'out/**',
      'dist/**',
      // 패키징 산출물과 함께 실리는 런타임 — 우리가 쓴 코드가 아니다.
      'release/**',
      'resources/**',
      '.cache/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.harness/**',
      'public/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    rules: {
      // A parameter kept only to satisfy an interface signature is not dead code;
      // `_name` is the existing convention for it (see MobileDriverApi.runScript).
      // Unused *variables* stay an error — those get deleted, per CLAUDE.md §6.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // postcss/tailwind configs are the only CommonJS files left in the repo.
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },

  // Main + preload: Node runtime. `.mjs` is included because the fetch sidecar's
  // launcher ships as one — it runs under real Node, not Electron, so it is
  // deliberately outside the TypeScript bundle (see src/main/sidecar/).
  {
    files: ['src/main/**/*.{ts,mjs}', 'src/preload/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Renderer: browser only. Hook rules live here and nowhere else.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Tests: Node + vitest globals (vitest runs with globals: true).
  {
    files: ['tests/**/*.ts', 'src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // Harness and build scripts: plain Node ESM, no TypeScript project.
  {
    files: ['*.config.{js,ts}', '.claude/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
