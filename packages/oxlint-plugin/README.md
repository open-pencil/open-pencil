# @open-pencil/oxlint-plugin

OpenPencil's code conventions as [Oxlint](https://oxc.rs/docs/guide/usage/linter) rules, for any TypeScript project that wants them. The rules cover runtime validation, type assertions, error handling, secrets, imports, and file layout.

```sh
npm install --save-dev oxlint @open-pencil/oxlint-plugin
```

```json
{
  "jsPlugins": ["@open-pencil/oxlint-plugin"],
  "rules": {
    "open-pencil/no-unvalidated-json-parse": "error",
    "open-pencil/no-silent-catch": "error",
    "open-pencil/valibot-schema-conventions": ["error", { "schemaModules": ["/src/contract/"] }]
  }
}
```

The plugin is named `open-pencil`. Every rule is off until the configuration turns it on, so a project picks the ones it follows.

## Recommended configuration

`@open-pencil/oxlint-plugin/recommended` is the configuration OpenPencil's own repositories extend: Oxlint's `typescript`, `import`, `unicorn`, `promise`, and `node` plugins with the built-in rules they follow, and every rule below except `no-raw-sql`, `no-dynamic-html`, and `no-unvalidated-route-params`, which fit only some code. Load the plugin beside it, since a configuration file cannot load a plugin for the one that extends it:

```json
{
  "extends": ["./node_modules/@open-pencil/oxlint-plugin/recommended.json"],
  "jsPlugins": ["@open-pencil/oxlint-plugin"],
  "rules": {
    "open-pencil/valibot-schema-conventions": ["error", { "schemaModules": ["/src/contract/"] }]
  }
}
```

An `extends` path resolves from the file that declares it, so a configuration in a nested workspace names the `node_modules` the package is installed in, such as `../../node_modules/@open-pencil/oxlint-plugin/recommended.json` when it is hoisted to the root. In `oxlint.config.ts`, import it instead, which resolves like any module, typed as `OxlintConfig`: `import recommended from '@open-pencil/oxlint-plugin/recommended'`, then `extends: [recommended]`. Some rules, such as `typescript/no-floating-promises`, run only with `oxlint --type-aware`. `max-lines` (600), `complexity` (20), and the `no-console` methods it allows are OpenPencil's choices; override any rule after `extends`.

## Rules

### Validation and data

| Rule                         | What it asks for                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-unvalidated-json-parse`  | Validate parsed JSON with a schema, `v.safeParse(v.pipe(v.string(), v.parseJson(), Schema), text)`, instead of asserting a type on `JSON.parse` or `.json()`.                 |
| `valibot-schema-conventions` | Name module-level Valibot schemas `<name>Schema` and export them only from a `schema.ts`, or from a directory in `schemaModules`. `{ "placement": false }` checks names only. |
| `no-hand-rolled-base64`      | Use `js-base64` instead of `atob`, `btoa`, or `Buffer` Base64 conversions.                                                                                                    |
| `prefer-es-toolkit`          | Use `es-toolkit`'s `uniq` and `compact` instead of `Set` round trips and `filter(Boolean)`.                                                                                   |
| `no-reduce-accumulator-copy` | Do not copy the accumulator on every `reduce` step.                                                                                                                           |
| `no-raw-sql`                 | Use Kysely's typed query builder instead of `sql` templates. Turn it off for migrations and reviewed helpers.                                                                 |

### Types

| Rule                               | What it asks for                                                          |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `no-broad-double-cast`             | No `as unknown as T`.                                                     |
| `no-unknown-record-double-cast`    | No `as unknown as Record<string, unknown>`.                               |
| `no-broad-unknown-type-assertions` | No assertions to `Record<string, unknown>` or inline shapes of `unknown`. |
| `no-widen-then-assert`             | Do not widen a known value and assert it back to a narrower type.         |
| `no-duplicate-type-shapes`         | One named type per object shape in a file.                                |
| `no-function-type`                 | An explicit signature instead of `Function`.                              |
| `no-import-type-annotations`       | A top-level `import type` instead of an inline `import()` type.           |
| `no-ts-suppression-comments`       | No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`.                    |

### Runtime and security

| Rule                                          | What it asks for                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-silent-catch`                             | No empty `catch` blocks.                                                                                                                                                                                     |
| `no-math-random`                              | `crypto.getRandomValues()` instead of `Math.random()`.                                                                                                                                                       |
| `no-reflect-delete-global-this-outside-tests` | No `Reflect.deleteProperty(globalThis, …)` outside `tests/`.                                                                                                                                                 |
| `no-module-mocking`                           | Inject dependencies instead of mocking modules in tests.                                                                                                                                                     |
| `no-secret-in-query`                          | Secrets and tokens in a URL fragment or request body, never its query string.                                                                                                                                |
| `no-secret-logging`                           | Never log secrets, tokens, cookies, or authorization values.                                                                                                                                                 |
| `no-dynamic-html`                             | Return typed JSON or a constant body; never build an HTML response from values. Every `.html(...)` call counts as a response, as Hono's `context.html` is, so turn it on for server code only.               |
| `no-unvalidated-route-params`                 | Read Hono route parameters from `context.req.valid('param')` behind a param validator, never `context.req.param()`, so a malformed ID is refused before it reaches a query. Turn it on for server code only. |
| `no-conditional-object-spreads`               | An explicit branch instead of several or large conditional spreads in one object.                                                                                                                            |

### Imports, naming, and layout

| Rule                                | What it asks for                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-deep-parent-relative-imports`   | An alias instead of `../../` imports. `minDepth` (default 2) sets how many `../` are too many, and `alias` names the alias in the message.                              |
| `no-deep-parent-relative-paths`     | A path helper or alias instead of climbing two directories from `import.meta`.                                                                                          |
| `no-cwd-relative-paths`             | A path resolved with `repoPath()` or `import.meta` before a file call or spawn uses it, not left relative to the working directory.                                     |
| `no-function-alias-imports`         | No imports renamed to end in `Fn`.                                                                                                                                      |
| `no-useless-pass-through-wrappers`  | No functions that only call another with the same arguments.                                                                                                            |
| `no-mixed-case-acronym-identifiers` | `baseURL`, not `baseUrl`. `ignoredImports` lists packages whose names keep their casing where imported, and `ignoredIdentifiers` lists upstream names used as they are. |
| `no-sibling-domain-prefixed-files`  | `list/actions.ts`, not `list-actions.ts` beside a `list/` folder.                                                                                                       |
