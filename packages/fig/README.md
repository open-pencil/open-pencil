# @open-pencil/fig

`.fig` document policy package for OpenPencil.

This package currently exposes low-level `fig-kiwi` container read/write helpers and remains the staging area for the next package-split stage. Use `@open-pencil/core` for production SceneGraph `.fig` read/write APIs until higher-level behavior moves here.

Current ownership:

- `readFigContainer()` / `writeFigContainer()` wrappers over `@open-pencil/kiwi` container helpers
- `.fig` document source typing

Planned ownership:

- `.fig` read/write orchestration
- SceneGraph ⇄ Figma NodeChange conversion policy
- raw Figma metadata preservation and invalidation
- component/instance interpretation
- oracle-backed `.fig` fixtures and package-local tests

Non-goals:

- low-level Kiwi schema/runtime/codec internals — use `@open-pencil/kiwi`
- editor actions, renderer behavior, Vue/app UI, CLI formatting, or MCP transport

See `packages/docs/development/fig-package-plan.md` for the staged migration plan.

## Checks

```sh
cd packages/fig
bun run check
```
