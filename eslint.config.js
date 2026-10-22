// ESLint: errores reales (variables sin definir, imports rotos, código inalcanzable…), sin reglas de estilo.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/main/**/*.js', 'build/**/*.mjs', 'tools/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/preload/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ort: 'readonly' } },
  },
  {
    // Lo usan el proceso principal y las páginas.
    files: ['src/shared/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
];
