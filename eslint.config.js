import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const AI_BRANDING_REGEX = /\b(AI|A\.I\.|Gemini|GPT|LLM|artificial intelligence|powered by|our strongest|machine learning)\b/i;
const BANNED_ICONS = new Set(['Sparkles', 'Wand', 'Wand2', 'Bot']);

const noAiBrandingRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow AI branding, banned marketing buzzwords, and sparkles/magic icons in UI code.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || '';
    const isAllowedFile =
      filename.includes('disclaimer') ||
      filename.includes('constants') ||
      filename.includes('privacy') ||
      filename.includes('Privacy') ||
      filename.includes('domain/rules') ||
      // The marketing landing page follows a separate brand track owned outside
      // the app design system; the owner has a dedicated plan for its copy.
      filename.includes('landing') ||
      filename.includes('Landing') ||
      filename.includes('eslint.config');

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'lucide-react') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' && BANNED_ICONS.has(specifier.imported.name)) {
              context.report({
                node: specifier,
                message: `Importing '${specifier.imported.name}' is banned. Use literal icons only (no sparkles, magic wands, or bots).`,
              });
            }
          }
        }
      },
      JSXText(node) {
        if (isAllowedFile) return;
        if (AI_BRANDING_REGEX.test(node.value)) {
          context.report({
            node,
            message: `Banned AI branding in UI text: "${node.value.trim()}". Name the benefit to the user, not the technology.`,
          });
        }
      },
      Literal(node) {
        if (isAllowedFile) return;
        if (typeof node.value === 'string' && AI_BRANDING_REGEX.test(node.value)) {
          if (node.parent && node.parent.type === 'ImportDeclaration') return;
          if (filename.includes('.test.') || filename.includes('.spec.')) return;
          context.report({
            node,
            message: `Banned AI branding string literal: "${node.value}". Name the benefit to the user, not the technology.`,
          });
        }
      },
    };
  },
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      local: {
        rules: {
          'no-ai-branding': noAiBrandingRule,
        },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'no-undef': 'off', // TypeScript handles undef checks with full typing
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'local/no-ai-branding': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'REBUILD/**'],
  },
];
