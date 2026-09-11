# Externally inspired lint rules

The following rules and their support helpers are adapted from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop), retrieved at commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`:

- `src/rules/quality/known-value-widening.ts`
- `src/rules/quality/module-mocking.ts`
- `src/rules/quality/reduce-accumulator-copy.ts`
- `src/rules/quality/widen-then-assert.ts`
- `src/support/{array-method,dictionary-types,function-parameters,lexical-type-parameters,scope,type-alias-resolution}.ts`

Upstream is MIT licensed. See `anti-slop-license.txt` in this directory for the license text. Local changes include OpenPencil plugin registration, Bun `mock.module` support, compatibility with the repository's TypeScript/Oxlint versions, and focused Bun tests.

## Maintenance

Treat these files as locally owned policy. When updating from upstream:

1. Compare against the recorded commit instead of replacing the directory wholesale.
2. Review semantic and false-positive changes rule by rule.
3. Preserve OpenPencil-specific behavior and test cases.
4. Update the commit above and run `bun run --cwd tools/lint test` plus `bun run lint`.

## Enabled rules

- `no-module-mocking`
- `no-reduce-accumulator-copy`
- `no-widen-then-assert`

`no-known-value-widening` is registered for audit use but intentionally not enabled. A repository-wide audit at the recorded revision produced 261 diagnostics: 117 anonymous-object targets, 114 open-dictionary targets, and 30 explicit `unknown` targets. Many are intentional return contracts, mutable dictionaries, serialization boundaries, and type-predicate calls, so enabling the upstream policy globally would create substantial noise. It may be reconsidered as narrower OpenPencil-specific rules.
