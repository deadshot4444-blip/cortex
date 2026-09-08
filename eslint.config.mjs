// ESLint flat config.
//
// The app is a set of classic <script> files that share one global scope: no bundler, no
// modules, load order defined by index.html and SECTION_SCRIPTS in app.js. Cross-file
// globals are therefore collected from the runtime files themselves (top-level
// declarations plus window.X exports) instead of being maintained by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import js from '@eslint/js';
import globals from 'globals';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const runtimeFiles = fs.readdirSync(ROOT).filter(name => name.endsWith('.js') && name !== 'eslint.config.mjs');
const exported = /(?:window|root|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
const sharedGlobals = {};
const bindingNames = pattern => {
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap(p => bindingNames(p.value || p.argument));
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(e => (e ? bindingNames(e) : []));
  if (pattern.type === 'AssignmentPattern') return bindingNames(pattern.left);
  if (pattern.type === 'RestElement') return bindingNames(pattern.argument);
  return [];
};
for (const file of runtimeFiles) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') sharedGlobals[node.id.name] = 'writable';
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) for (const name of bindingNames(declarator.id)) sharedGlobals[name] = 'writable';
    }
  }
  for (const match of text.matchAll(exported)) sharedGlobals[match[1]] = 'writable';
}

const unusedVars = ['warn', { vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }];
const sharedRules = {
  'no-unused-vars': unusedVars,
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-redeclare': ['error', { builtinGlobals: false }],
  'no-prototype-builtins': 'off',
  'no-cond-assign': ['error', 'except-parens'],
};

export default [
  {
    ignores: ['node_modules/', 'assets/', 'data/', 'context/', 'output/', '.playwright-cli/'],
  },
  js.configs.recommended,
  {
    // Runtime modules served to the browser.
    files: ['*.js'],
    ignores: ['eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...sharedGlobals,
        supabase: 'readonly', // assets/supabase.js (UMD build)
        module: 'readonly', // UMD wrappers in the *-engine.js files
        globalThis: 'readonly',
      },
    },
    rules: sharedRules,
  },
  {
    files: ['offline-worker.js', 'python-runtime-worker.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.worker, ...sharedGlobals, loadPyodide: 'readonly' },
    },
  },
  {
    // Netlify edge functions run on Deno.
    files: ['netlify/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.browser },
    rules: sharedRules,
  },
  {
    // Tooling and tests run on Node. Unit harnesses evaluate runtime modules inside vm
    // contexts, so the app's globals are legitimate there too.
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser, ...sharedGlobals },
    },
    rules: sharedRules,
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...sharedGlobals },
    },
    rules: sharedRules,
  },
  {
    // Playwright suites pass callbacks to page.evaluate(); those bodies run inside the page
    // and reference in-page state ESLint cannot see.
    files: ['scripts/smoke-*.mjs', 'scripts/test-*.mjs'],
    rules: { 'no-undef': 'off' },
  },
];
