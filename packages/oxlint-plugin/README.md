# @open-pencil/oxlint-plugin

OpenPencil's code conventions as [Oxlint](https://oxc.rs/docs/guide/usage/linter) rules, for any TypeScript project that wants them. The rules cover runtime validation, type assertions, error handling, secrets, imports, and file layout.

```sh
npm install --save-dev oxlint @open-pencil/oxlint-plugin
```

```json
{
  "jsPlugins": ["@open-pencil/oxlint-plugin/data", "@open-pencil/oxlint-plugin/runtime"],
  "rules": {
    "@open-pencil/data/no-unvalidated-json-parse": "error",
    "@open-pencil/runtime/no-silent-catch": "error",
    "@open-pencil/data/valibot-schema-conventions": [
      "error",
      { "schemaModules": ["/src/contract/"] }
    ]
  }
}
```

The package holds one plugin per domain, each loaded from its own path and named for it: `@open-pencil/oxlint-plugin/data` is the `@open-pencil/data` plugin, whose rules are `@open-pencil/data/<rule>`. The domains are `data`, `types`, `runtime`, `security`, `imports`, and `structure`; load the ones whose rules you turn on. Every rule is off until the configuration turns it on, so a project picks the ones it follows.

## Recommended configuration

`@open-pencil/oxlint-plugin/recommended` is the configuration OpenPencil's own repositories extend: Oxlint's `typescript`, `import`, `unicorn`, `promise`, and `node` plugins with the built-in rules they follow, and every rule below except `@open-pencil/data/no-raw-sql`, `@open-pencil/data/no-raw-runtime-effect`, `@open-pencil/security/no-dynamic-html`, and `@open-pencil/security/no-unvalidated-route-params`, which fit only some code. Load every domain plugin beside it, since a configuration file cannot load a plugin for the one that extends it:

```json
{
  "extends": ["./node_modules/@open-pencil/oxlint-plugin/recommended.json"],
  "jsPlugins": [
    "@open-pencil/oxlint-plugin/data",
    "@open-pencil/oxlint-plugin/imports",
    "@open-pencil/oxlint-plugin/runtime",
    "@open-pencil/oxlint-plugin/security",
    "@open-pencil/oxlint-plugin/structure",
    "@open-pencil/oxlint-plugin/types"
  ],
  "rules": {
    "@open-pencil/data/valibot-schema-conventions": [
      "error",
      { "schemaModules": ["/src/contract/"] }
    ]
  }
}
```

An `extends` path resolves from the file that declares it, so a configuration in a nested workspace names the `node_modules` the package is installed in, such as `../../node_modules/@open-pencil/oxlint-plugin/recommended.json` when it is hoisted to the root. In `oxlint.config.ts`, import it instead, which resolves like any module, typed as `OxlintConfig`: `import recommended from '@open-pencil/oxlint-plugin/recommended'`, then `extends: [recommended]`. Some rules, such as `typescript/no-floating-promises`, run only with `oxlint --type-aware`. `max-lines` (600), `complexity` (20), and the `no-console` methods it allows are OpenPencil's choices; override any rule after `extends`.

## Rules

### Validation and data: `@open-pencil/oxlint-plugin/data`

| Rule                                           | What it asks for                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@open-pencil/data/no-unvalidated-json-parse`  | Validate parsed JSON with a schema, `v.safeParse(v.pipe(v.string(), v.parseJson(), Schema), text)`, instead of asserting a type on `JSON.parse` or `.json()`.                 |
| `@open-pencil/data/valibot-schema-conventions` | Name module-level Valibot schemas `<name>Schema` and export them only from a `schema.ts`, or from a directory in `schemaModules`. `{ "placement": false }` checks names only. |
| `@open-pencil/data/no-hand-rolled-base64`      | Use `js-base64` instead of `atob`, `btoa`, or `Buffer` Base64 conversions.                                                                                                    |
| `@open-pencil/data/prefer-es-toolkit`          | Use `es-toolkit`'s `uniq` and `compact` instead of `Set` round trips and `filter(Boolean)`.                                                                                   |
| `@open-pencil/data/no-reduce-accumulator-copy` | Do not copy the accumulator on every `reduce` step.                                                                                                                           |
| `@open-pencil/data/no-spread-arguments`        | Do not spread a list into `push`, `unshift`, `splice`, `Math.max`/`min`, or `String.fromCharCode`/`fromCodePoint`; past about 120,000 items Chrome throws.                    |
| `@open-pencil/data/no-raw-sql`                 | Use Kysely's typed query builder instead of `sql` templates. Turn it off for migrations and reviewed helpers.                                                                 |
| `@open-pencil/data/no-raw-runtime-effect`      | Compile SkSL only through the module that checks every program, not with `RuntimeEffect.Make`. Turn it off for that module.                                                   |

### Types: `@open-pencil/oxlint-plugin/types`

| Rule                                               | What it asks for                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `@open-pencil/types/no-broad-double-cast`          | No `as unknown as T`.                                                     |
| `@open-pencil/types/no-unknown-record-double-cast` | No `as unknown as Record<string, unknown>`.                               |
| `@open-pencil/types/no-broad-unknown-assertions`   | No assertions to `Record<string, unknown>` or inline shapes of `unknown`. |
| `@open-pencil/types/no-widen-then-assert`          | Do not widen a known value and assert it back to a narrower type.         |
| `@open-pencil/types/no-duplicate-shapes`           | One named type per object shape in a file.                                |
| `@open-pencil/types/no-function-type`              | An explicit signature instead of `Function`.                              |
| `@open-pencil/types/no-import-type-annotations`    | A top-level `import type` instead of an inline `import()` type.           |
| `@open-pencil/types/no-suppression-comments`       | No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`.                    |

### Runtime and errors: `@open-pencil/oxlint-plugin/runtime`

| Rule                                                               | What it asks for                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `@open-pencil/runtime/no-math-random`                              | `crypto.getRandomValues()` instead of `Math.random()`.                            |
| `@open-pencil/runtime/no-silent-catch`                             | No empty `catch` blocks.                                                          |
| `@open-pencil/runtime/no-conditional-object-spreads`               | An explicit branch instead of several or large conditional spreads in one object. |
| `@open-pencil/runtime/no-reflect-delete-global-this-outside-tests` | No `Reflect.deleteProperty(globalThis, …)` outside `tests/`.                      |
| `@open-pencil/runtime/no-module-mocking`                           | Inject dependencies instead of mocking modules in tests.                          |

### Security: `@open-pencil/oxlint-plugin/security`

| Rule                                                | What it asks for                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@open-pencil/security/no-dynamic-html`             | Return typed JSON or a constant body; never build an HTML response from values. Every `.html(...)` call counts as a response, as Hono's `context.html` is, so turn it on for server code only.               |
| `@open-pencil/security/no-secret-in-query`          | Secrets and tokens in a URL fragment or request body, never its query string.                                                                                                                                |
| `@open-pencil/security/no-secret-logging`           | Never log secrets, tokens, cookies, or authorization values.                                                                                                                                                 |
| `@open-pencil/security/no-unvalidated-route-params` | Read Hono route parameters from `context.req.valid('param')` behind a param validator, never `context.req.param()`, so a malformed ID is refused before it reaches a query. Turn it on for server code only. |

### Imports and paths: `@open-pencil/oxlint-plugin/imports`

| Rule                                                   | What it asks for                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@open-pencil/imports/no-deep-parent-relative-imports` | An alias instead of `../../` imports. `minDepth` (default 2) sets how many `../` are too many, and `alias` names the alias in the message. |
| `@open-pencil/imports/no-deep-parent-relative-paths`   | A path helper or alias instead of climbing two directories from `import.meta`.                                                             |
| `@open-pencil/imports/no-cwd-relative-paths`           | A path resolved with `repoPath()` or `import.meta` before a file call or spawn uses it, not left relative to the working directory.        |
| `@open-pencil/imports/no-function-aliases`             | No imports renamed to end in `Fn`.                                                                                                         |

### Naming and layout: `@open-pencil/oxlint-plugin/structure`

| Rule                                                       | What it asks for                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@open-pencil/structure/no-sibling-domain-prefixed-files`  | `list/actions.ts`, not `list-actions.ts` beside a `list/` folder.                                                                                                       |
| `@open-pencil/structure/no-useless-pass-through-wrappers`  | No functions that only call another with the same arguments.                                                                                                            |
| `@open-pencil/structure/no-mixed-case-acronym-identifiers` | `baseURL`, not `baseUrl`. `ignoredImports` lists packages whose names keep their casing where imported, and `ignoredIdentifiers` lists upstream names used as they are. |
