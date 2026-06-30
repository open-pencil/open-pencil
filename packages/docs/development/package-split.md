# Package split plan

OpenPencil is splitting stable compatibility layers into independently publishable packages while keeping editor/runtime behavior intact. Each package boundary should be narrow, covered by package-local checks, and consumed through public workspace exports.

## Goals

- Keep renderer/editor core free of DOM and browser-only dependencies.
- Let `.fig`, Kiwi, and DOM/CSS compatibility evolve without forcing consumers to install unrelated heavy dependencies.
- Preserve import/export fidelity by moving code only after oracle coverage exists.
- Keep public APIs narrow and package-local checks available for every standalone package.

## Current package boundary

- `@open-pencil/core` owns scene graph, renderer, editor actions, Figma API compatibility, `.fig` SceneGraph policy, and format import/export.
- `@open-pencil/dom-css` owns DesignDOM, CSS runtimes, HTML/JSX/Tailwind projection, and SceneGraph ⇄ DesignDOM conversion.
- `@open-pencil/kiwi` owns pure Kiwi schema/runtime code plus low-level Figma Kiwi codec, container, and parse helpers.
- App, CLI, MCP, and Vue SDK consume packages through public workspace exports only.

See [`kiwi-package-plan.md`](./kiwi-package-plan.md) for the detailed `@open-pencil/kiwi` inventory, package-local test plan, and remaining split boundaries. See [`fig-package-plan.md`](./fig-package-plan.md) for the staged `@open-pencil/fig` split. See [`dom-css-parser-audit.md`](./dom-css-parser-audit.md) for the DOM/CSS rule against expanding hand-rolled CSS parsing.

## Candidate packages

### `@open-pencil/kiwi`

Status: extracted.

Scope:

- Kiwi binary schema runtime.
- Figma Kiwi schema data and validation.
- Low-level Figma Kiwi protocol/message helpers.
- Structural `NodeChange` encode/decode.
- FIG GUID parsing/formatting helpers.
- `fig-kiwi` container framing and raw parse helpers that do not create `SceneGraph` objects.

Does not include:

- SceneGraph conversion.
- Raw metadata invalidation policy.
- Component/instance override interpretation.
- Renderer/editor code.

Minimum maintenance criteria:

- Package-local typecheck, unit tests, build, and dist smoke.
- No `@open-pencil/core`, `#core/*`, app, CLI, MCP, or Vue imports.
- Existing repo-level Kiwi/FIG tests continue to pass through public package APIs.

### `@open-pencil/fig`

Scope:

- `.fig` document read/write policy.
- Figma node-change import/export.
- Raw metadata preservation and invalidation policy.
- Figma component/instance interpretation.
- Figma oracle fixtures and compatibility helpers.

Should depend on:

- `@open-pencil/core` scene graph types and conversion policy while those remain core-owned.
- `@open-pencil/kiwi` for low-level schema/runtime/container/codec helpers.

Should not include:

- Canvas rendering.
- Editor UI/actions.
- DOM/CSS compatibility.

Minimum exit criteria:

- Import/export round-trip tests moved or duplicated as package-local coverage.
- Heavy Figma fixture coverage still available at repo level.
- Public API supports CLI/MCP/app document I/O without private path imports.

## Current inventory

In `@open-pencil/kiwi`:

- `packages/kiwi/src/schema-runtime/**`
- `packages/kiwi/src/fig/schema/**`
- `packages/kiwi/src/fig/schema.ts`
- `packages/kiwi/src/fig/protocol.ts`
- `packages/kiwi/src/fig/types.ts`
- `packages/kiwi/src/fig/guid.ts`
- `packages/kiwi/src/fig/variable-bindings.ts`
- `packages/kiwi/src/fig/codec.ts`
- `packages/kiwi/src/fig/container.ts`
- `packages/kiwi/src/fig/parse.ts`

Likely `@open-pencil/fig` candidates:

- `packages/core/src/kiwi/fig/file.ts`
- `packages/core/src/kiwi/fig/parse/transfer.ts`
- `packages/core/src/kiwi/fig/parse/worker.ts`
- `packages/core/src/kiwi/fig/import.ts`
- `packages/core/src/kiwi/fig/lazy-import.ts`
- `packages/core/src/kiwi/fig/node-change/**`
- `packages/core/src/kiwi/fig/instance-overrides/**`
- `packages/core/src/io/formats/fig/**`

Keep in `@open-pencil/core` unless proven otherwise:

- `SceneGraph` and node type definitions.
- Renderer/editor fallback behavior.
- Layout, text measurement, and canvas-specific code.
- Generic IO registry contracts that other formats use.

## Migration checklist

1. Add package-local tests before moving files.
2. Confirm every moved module imports only allowed public package exports.
3. Prefer direct imports from the new package for internal code; avoid accumulating deep re-export shims.
4. Preserve only intentional public compatibility barrels, such as `@open-pencil/core/kiwi`, when external consumers need a deprecation window.
5. Move one boundary at a time: schema/runtime first, low-level codec/container/parse second, `.fig` policy last.
6. Keep fixture/oracle tests in the repo-level suite even after package-local tests exist.
7. Run package smoke checks from a temporary consumer project before publishing.

## Migration order

1. Keep `@open-pencil/dom-css` standalone and stabilize its browser/headless runtime split.
2. Extract pure Kiwi runtime/codecs behind `@open-pencil/kiwi` without moving `.fig` SceneGraph policy.
3. Move `.fig` document policy and node-change conversion into `@open-pencil/fig` when the boundary is clear.
4. Update core/app/CLI/MCP imports to consume public package exports.
5. Keep compatibility re-exports in `@open-pencil/core` only if existing consumers need a deprecation window.

## Non-goals

- Do not guess Figma schema fields during the split.
- Do not move renderer-specific fallback behavior into file-format packages.
- Do not add browser DOM dependencies to core or file-format packages.
- Do not widen app/CLI imports to private package source paths.
