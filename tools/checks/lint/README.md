# OpenPencil lint rules

`src/plugin.ts` registers locally owned rules; the workspace `oxlint.json` selects policy. Run `bun run --cwd tools/checks/lint test` for rule tests and `bun run lint` for repository enforcement.

## Test and type policies

- `no-module-mocking` rejects Bun, Vitest, and Jest module registry mocking, including Bun's `mock` and `jest` exports and Vitest's `vi` and `vitest` exports. Scoped spies and injected dependencies remain supported. Detection covers direct framework calls and renamed named imports, not arbitrary alias propagation or destructuring.
- `no-reduce-accumulator-copy` detects unbounded accumulator copies through `Object.assign`, `Array.from`, and array copy methods. It complements `oxc/no-accumulating-spread`. Literal-bounded slices such as `slice(0, 2)` and `slice(-2)` are allowed; `slice(2)` and `slice(0, -1)` still copy a potentially growing range. This is a conservative syntactic check, not a proof of quadratic runtime for every reducer.
- `no-widen-then-assert` detects immutable local bindings widened to broad types and then asserted narrower in the same function. It intentionally avoids inferring arbitrary type aliases, imported return types, or cross-function flows.

The experimental known-value-widening audit is not included: its broad policy produced too many intentional-contract diagnostics to justify maintaining a separate type resolver.

## Maintenance

Upstream attribution and the full license are in [NOTICE](./NOTICE). These are adapted, locally owned rules, not an automatically synchronized vendor directory. Compare any upstream updates against the recorded commit, preserve local behavior, and add positive and negative regression cases before changing enforcement.

Tests share `tests/helpers/lint.ts`, which invokes the real Oxlint plugin, rejects parser/configuration failures, and cleans each fixture in `finally`. Keep test infrastructure out of runtime source helpers.
