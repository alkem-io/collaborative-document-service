import { defineConfig } from 'eslint/config';

import tsParser from '@typescript-eslint/parser';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});
const env = (prod, dev) => (process.env.NODE_ENV === 'production' ? prod : dev);

export default defineConfig([
  // Global ignores: a config object whose ONLY key is `ignores` applies to
  // every config in the array (including the flat-compat-derived configs
  // below), unlike the `ignores` nested in the ts/tsx config object which
  // only scopes that one config. Without this, ESLint 9 flat-config mode
  // (which no longer honors the CLI `--ext` flag) linted committed `dist/`
  // build output with the compat-derived @typescript-eslint rules, which
  // don't have the plugin registered for non-ts/tsx files.
  {
    ignores: ['**/node_modules/**', '**/dist/**'],
  },
  {
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
      },

      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      prettier,
    },

    extends: compat.extends(
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
      'prettier'
    ),

    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      'no-console': env(1, 0),
      'no-debugger': env(1, 0),
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-unused-vars': [
        env(2, 1),
        {
          argsIgnorePattern: '^_',
        },
      ],

      'no-multiple-empty-lines': 'error',
    },
    files: ['**/*.{ts,tsx}'],
  },
]);
