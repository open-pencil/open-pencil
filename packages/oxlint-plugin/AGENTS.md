# @open-pencil/oxlint-plugin

The published Oxlint plugin. `lint/plugin.js` combines it with this repository's own rules from `tools/checks/lint` into the one `open-pencil` plugin `oxlint.json` configures.

- A rule belongs here only when it holds for any TypeScript project. Paths, packages, and names a project chooses are rule options, set in `oxlint.json`, never constants in the rule (`schemaModules` in `src/rules/quality/valibot-schemas.ts`, `ignoredImports` in `src/rules/naming.ts`); rules about the app, Vue, Tauri, or the scene graph stay in `tools/checks/lint`.
- Type rules with `@oxlint/plugins` (`defineRule`, `ESTree`), never `@typescript-eslint/utils`, so the published declarations need no other package (`check:packages`).
- Import the package's own modules through `#oxlint-plugin/*` without an extension: `lint/plugin.js` loads the source under Node, which resolves the alias to the `.ts` file, so `bun run lint` needs no build.
- A new rule is registered in `src/index.ts`, listed in `README.md`, and tested in `tests/rules/`, mirroring its source file, through `tests/helpers/lint.ts`, which runs Oxlint on the package source.
- Renaming or removing a rule breaks consumers' configurations; record it under `breaking` in the changelog.
