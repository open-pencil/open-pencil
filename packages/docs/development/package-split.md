# Package split plan

OpenPencil currently keeps file-format internals in `@open-pencil/core` while `@open-pencil/dom-css` is being split out as a standalone DOM/CSS compatibility layer. Future package splits should preserve the current app behavior first, then move stable surfaces into independently publishable packages.

## Goals

- Keep renderer/editor core free of DOM and browser-only dependencies.
- Let `.fig`, Kiwi, and DOM/CSS compatibility evolve without forcing consumers to install unrelated heavy dependencies.
- Preserve import/export fidelity by moving code only after oracle coverage exists.
- Keep public APIs narrow and package-local checks available for every standalone package.

## Current package boundary

- `@open-pencil/core` owns scene graph, renderer, editor actions, Figma API compatibility, Kiwi codec internals, and format import/export.
- `@open-pencil/dom-css` owns DesignDOM, CSS runtimes, HTML/JSX/Tailwind projection, and SceneGraph ⇄ DesignDOM conversion.
- App, CLI, MCP, and Vue SDK consume packages through public workspace exports only.

## Candidate packages

### `@open-pencil/kiwi`

Scope:

- Kiwi binary schema runtime.
- Schema-generated codec modules.
- Generic binary parse/serialize helpers.
- Low-level validation helpers that do not know about OpenPencil scene graph nodes.

Should not include:

- Figma `.fig` container policy.
- SceneGraph conversion.
- Renderer/editor code.

Minimum exit criteria:

- Package-local typecheck, unit tests, build, and dist smoke.
- Existing Kiwi serialize/parse tests passing through the package public API.
- No import cycles from `@open-pencil/core` back into the package.

### `@open-pencil/fig`

Scope:

- `.fig` container read/write.
- Figma node-change import/export.
- Raw metadata preservation and invalidation policy.
- Figma oracle fixtures and compatibility helpers.

Should depend on:

- `@open-pencil/core` scene graph types.
- `@open-pencil/kiwi` once the Kiwi split exists.

Should not include:

- Canvas rendering.
- Editor UI/actions.
- DOM/CSS compatibility.

Minimum exit criteria:

- Import/export round-trip tests moved or duplicated as package-local coverage.
- Heavy Figma fixture coverage still available at repo level.
- Public API supports CLI/MCP/app document I/O without private path imports.

## Migration order

1. Keep `@open-pencil/dom-css` standalone and stabilize its browser/headless runtime split.
2. Extract pure Kiwi runtime/codecs behind `@open-pencil/kiwi` without moving `.fig` policy.
3. Move `.fig` container and node-change conversion into `@open-pencil/fig`.
4. Update core/app/CLI/MCP imports to consume public package exports.
5. Keep compatibility re-exports in `@open-pencil/core` only if existing consumers need a deprecation window.

## Non-goals

- Do not guess Figma schema fields during the split.
- Do not move renderer-specific fallback behavior into file-format packages.
- Do not add browser DOM dependencies to core or file-format packages.
