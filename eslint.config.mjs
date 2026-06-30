import js from '@eslint/js';

const browserGlobals = {
  chrome: 'readonly',
  document: 'readonly',
  window: 'readonly',
  location: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  CSS: 'readonly',
  getComputedStyle: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  confirm: 'readonly',
  alert: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
};

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  module: 'readonly',
  require: 'readonly',
  __dirname: 'readonly',
};

export default [
  { ignores: ['dist/', 'node_modules/', '.cache/'] },
  js.configs.recommended,
  {
    // Extension scripts (plain <script> / service worker).
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Service worker pulls shared helpers in via importScripts('shared.js').
    files: ['background.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        importScripts: 'readonly',
        mergeSettings: 'readonly',
      },
    },
  },
  {
    // Content scripts injected alongside shared.js (background.js executeScript
    // injects ['shared.js', <script>]); shared.js attaches helpers to globalThis.
    files: ['printClean.js', 'printPreview.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        normalizeHost: 'readonly',
        isValidDomain: 'readonly',
        mergeSettings: 'readonly',
        buildHideCss: 'readonly',
        buildIsolateCss: 'readonly',
        buildHighlightCss: 'readonly',
        printableWidthPx: 'readonly',
        pageBoxCss: 'readonly',
        mmToPx: 'readonly',
        HIGHLIGHT_COLOR: 'readonly',
        PAGE_WIDTH_MM: 'readonly',
        MARGIN_MM: 'readonly',
      },
    },
  },
  {
    // Build scripts (ESM, Node).
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    // Unit tests (CommonJS, Node).
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
  },
];
