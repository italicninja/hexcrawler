import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'archive/', 'tests/qa-agent/', '*.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: '19.0' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // prop-types removed - TypeScript handles this now
      'react/prop-types': 'off',
      'no-console': 'off', // Allow console in dev (logger handles production)
      // Base rule must be off for TS; the @typescript-eslint version handles it
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // --- Baseline exclusions (re-enable incrementally, see TODO.md) ---
      // React-Compiler-era rules new in react-hooks v7; the codebase predates them.
      // Turning them on requires per-component refactors, not a lint-config change.
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      // 14 legacy dependency-array violations; fixing dep arrays blindly changes
      // behavior. Re-enable after the OverworldScene split (TODO #3).
      'react-hooks/exhaustive-deps': 'off',
      // Scene/UI files mix component and non-component exports; HMR nicety only.
      'react-refresh/only-export-components': 'off',
    },
  },
  prettier
);
