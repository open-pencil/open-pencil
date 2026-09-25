# @open-pencil/fig

`.fig` file-format package for OpenPencil.

The package owns the outer `.fig` archive boundary and is the staged home for Figma-specific
SceneGraph conversion policy. Production SceneGraph read/write remains available through
`@open-pencil/core/io` while conversion modules move behind this package's public API.

Current ownership:

- Complete `.fig` archive parsing through `parseFigBuffer()`
- `.fig` archive assembly through `writeFigArchive()`
- Canvas payload and image resource handling
- `readFigContainer()` / `writeFigContainer()` helpers for raw `fig-kiwi` payloads
- `.fig` source and archive result types
- NodeChange-to-SceneGraph property conversion, including styles, plugin metadata, text, paint, vector, and font policy, through `@open-pencil/fig/node-change`
- Component-property, symbol-override, derived-symbol-data, and instance synchronization policy through `@open-pencil/fig/instance-overrides`
- Effective raw-metadata precedence and invalidation over SceneGraph's format-neutral edited-field tracking
- SceneGraph-to-`NodeChange` export conversion with an explicit glyph-outline runtime service
- Package-local archive, conversion, instance, export, and dist smoke tests

## Architecture documentation

Start with [the package docs](./docs/README.md) for the source model, instance evaluation,
materialization, document sessions, export, and validation contracts. The replacement is
complete only when every consumer is migrated and the old reader is deleted.

Planned ownership:

- Oracle-backed `.fig` fixtures

Non-goals:

- Generic Kiwi schema/runtime internals — use `@open-pencil/kiwi`
- Format-neutral IO registration, export targeting, CanvasKit thumbnails, or browser workers — use
  `@open-pencil/core/io`
- Editor actions, renderer behavior, Vue/app UI, CLI formatting, or MCP transport

This follows the existing `@open-pencil/pen` pattern: a format package owns its source model/parser
and SceneGraph policy, while core registers it in the shared IO system.

## Checks

```sh
cd packages/fig
bun run check
```
