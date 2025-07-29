
import simpleImportSort from 'eslint-plugin-simple-import-sort';

/** @type {import("eslint").FlatConfig[]} */
export default [
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        XMLHttpRequest: 'readonly',
        EventSource: 'readonly',
        WebSocket: 'readonly',
        Intl: 'readonly',
        Promise: 'readonly',
        // Firebase globals
        firebase: 'readonly',
        // Razorpay globals
        Razorpay: 'readonly'
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
