import simpleImportSort from 'eslint-plugin-simple-import-sort';

/** @type {import("eslint").FlatConfig[]} */
export default [
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      env: {
        browser: true,
        node: true
      }
    },
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'simple-import-sort/imports': 'warn',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  }
];
