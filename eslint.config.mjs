// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // jest.config.js son CommonJS puro (Node los carga directo, sin transpilar).
    files: ['**/jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly' },
    },
  },
  {
    rules: {
      // Un guion bajo inicial marca explicitamente "no usado a proposito"
      // (parametros de interfaz, catch de errores que no se inspeccionan, etc.)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // El estilo del proyecto usa "any" puntualmente para SDKs de terceros sin tipos
      // (Mercado Pago, Didit) -- se documenta en el propio codigo, no se prohibe.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
