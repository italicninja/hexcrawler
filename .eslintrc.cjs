module.exports = {
  root: true,
  env: { browser: true, es2025: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '19.0' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // prop-types removed - TypeScript handles this now
    'react/prop-types': 'off',
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console in dev (logger handles production)
  },
};
