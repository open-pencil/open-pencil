# @open-pencil/oxlint-plugin

The published Oxlint plugins, one per domain (`src/plugins/<domain>.ts`, named `@open-pencil/<domain>`). `lint/<domain>.js` combines each with this repository's rules of the same domain from `tools/checks/lint` into the plugin `oxlint.json` loads.

- A rule belongs here only when it holds for any TypeScript project. Paths, packages, and names a project chooses are rule options, set in `oxlint.json`, never constants in the rule (`schemaModules` in `src/rules/quality/valibot-schemas.ts`, `ignoredImports` in `src/rules/naming.ts`); rules about the app, Vue, Tauri, or the scene graph stay in `tools/checks/lint`, registered under their domain in `src/domains.ts`.
- Type rules with `@oxlint/plugins` (`defineRule`, `ESTree`), never `@typescript-eslint/utils`, so the published declarations need no other package (`check:packages`).
- Import the package's own modules through `#oxlint-plugin/*` without an extension: `lint/<domain>.js` loads the source under Node, which resolves the alias to the `.ts` file, so `bun run lint` needs no build.
- A new rule is registered in its domain's `src/plugins/<domain>.ts` under a name that does not repeat the domain, listed in that domain's `README.md` table, turned on in `recommended.json` unless it fits only some code (then it joins `OPT_IN` in `tests/recommended.test.ts`), and tested in `tests/rules/`, mirroring its source file, through `tests/helpers/lint.ts`, which runs Oxlint on the package source.
- `recommended.json` holds the built-in rules every OpenPencil repository follows; this repository's `oxlint.json` extends it and adds only its own rules, options, and overrides.
- Renaming or removing a rule breaks consumers' configurations; record it under `breaking` in the changelog.
