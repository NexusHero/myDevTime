// Flat ESLint config (SKILL §2.4). Type-checked rules run only on package/app
// source (files that live in a tsconfig); root config & scripts get the plain
// recommended rules, so they don't need to be part of a TS project.
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'spikes/**', 'e2e/**'],
  },
  {
    files: ['{packages,apps}/*/src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A suppression needs a justification, never a bare disable (SKILL §2.4).
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      // New in typescript-eslint 8.72's strict preset, and option-less. It assumes a
      // class-typed value must come from its constructor, which this codebase never
      // does by design: nestjs-zod DTOs are plain objects the Zod pipe parses, Nest's
      // `NestApplicationContextOptions` is an options bag, and a Drizzle transaction
      // is passed where `Db` is expected. All 45 hits were these; none was a bug.
      '@typescript-eslint/no-unsafe-class-instance-assignment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // NestJS (apps/api, ADR-0025) is decorator-driven: `@Module`/`@Injectable`
    // classes are legitimately member-light or static-only, so the extraneous-
    // class rule (fine for the pure packages) does not apply to the backend.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Tests may lean on non-null assertions for fixtures.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Root/tool config files and Node scripts — lint without type information.
    files: ['*.{js,mjs,ts}', '**/*.config.{js,mjs,ts}', 'scripts/**/*.{js,mjs}'],
    extends: [eslint.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
