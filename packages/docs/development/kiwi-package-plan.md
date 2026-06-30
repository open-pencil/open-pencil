# `@open-pencil/kiwi` extraction plan

`@open-pencil/kiwi` is the standalone package for scene-graph-agnostic Kiwi runtime code. It owns low-level Kiwi schema parsing, Figma Kiwi schema data, binary message encode/decode, FIG Kiwi container framing helpers, and raw `.fig` parse helpers that return structural `NodeChange` data.

`.fig` import/export policy still lives in `@open-pencil/core` until a future `@open-pencil/fig` split. Core owns SceneGraph conversion, raw metadata invalidation, component/instance interpretation, and app/CLI-facing document I/O.

## Current package boundary

### In `@open-pencil/kiwi`

| Path | Scope |
|---|---|
| `packages/kiwi/src/schema-runtime/**` | Pure Kiwi schema parsing, validation, binary encode/decode, and byte-buffer utilities. |
| `packages/kiwi/src/fig/schema/fig.kiwi` | Static Figma Kiwi schema text. |
| `packages/kiwi/src/fig/schema.ts` | Parses and validates the bundled Figma Kiwi schema. |
| `packages/kiwi/src/fig/protocol.ts` | Low-level Figma multiplayer/Kiwi byte inspection and message-type helpers. |
| `packages/kiwi/src/fig/types.ts` | Minimal structural `GUID`, `Color`, `Vector`, and `Matrix` types used by low-level FIG helpers. |
| `packages/kiwi/src/fig/guid.ts` | GUID string formatting/parsing helpers used by low-level FIG data. |
| `packages/kiwi/src/fig/variable-bindings.ts` | Variable binding binary encode/decode helpers. |
| `packages/kiwi/src/fig/codec.ts` | Figma Kiwi message encode/decode and structural `NodeChange` helpers. |
| `packages/kiwi/src/fig/container.ts` | `fig-kiwi` byte container framing and compression helpers. |
| `packages/kiwi/src/fig/parse.ts` | `.fig` zip/canvas parsing into structural node changes, blobs, images, schema bytes, and container version. |

Public exports:

```json
{
  ".": "./dist/index.js",
  "./schema-runtime": "./dist/schema-runtime.js",
  "./fig": "./dist/fig.js",
  "./fig/codec": "./dist/fig/codec.js",
  "./fig/container": "./dist/fig/container.js",
  "./fig/guid": "./dist/fig/guid.js",
  "./fig/parse": "./dist/fig/parse.js"
}
```

`@open-pencil/kiwi` must not import `@open-pencil/core`, `#core/*`, app code, Vue code, CLI code, or MCP code.

### Kept in `@open-pencil/core` for now

| Path | Reason it stays |
|---|---|
| `packages/core/src/kiwi/fig/import.ts` | Creates `SceneGraph`, imports variables/components/pages, and applies OpenPencil source metadata. |
| `packages/core/src/kiwi/fig/lazy-import.ts` | Stores lazy import context in `SceneGraph` weak maps. |
| `packages/core/src/kiwi/fig/node-change/**` | Converts between Figma `NodeChange` records and OpenPencil `SceneNode`, text, vector, paint, font, and layout types. |
| `packages/core/src/kiwi/fig/instance-overrides/**` | Resolves Figma component/instance override semantics into `SceneGraph`. |
| `packages/core/src/kiwi/fig/parse/transfer.ts` | Serializes `SceneGraph` data for worker transfer. |
| `packages/core/src/kiwi/fig/parse/worker.ts` | Worker glue: parses through `@open-pencil/kiwi/fig/parse`, then imports into `SceneGraph`. |
| `packages/core/src/kiwi/fig/file.ts` | Core `.fig` I/O re-export. |
| `packages/core/src/io/formats/fig/**` | App/CLI-facing `.fig` read/write policy and renderer-backed export behavior. |

`@open-pencil/core/kiwi` remains the compatibility barrel for existing public consumers, but deep core shims for moved Kiwi internals have been removed. Internal core code imports low-level helpers directly from `@open-pencil/kiwi`.

## Completed extraction sequence

1. Added `packages/kiwi` with schema runtime, Figma schema data, package-local tests, build, and dist smoke.
2. Moved low-level protocol/schema helpers into `@open-pencil/kiwi`.
3. Moved variable binding binary helpers into `@open-pencil/kiwi`.
4. Removed core color/type dependencies from the low-level FIG codec by making color normalization caller-owned and defining structural FIG types in Kiwi.
5. Moved Figma Kiwi codec, parse helpers, and container helpers into `@open-pencil/kiwi`.
6. Rewired core internals and tests to import moved helpers from `@open-pencil/kiwi` directly.
7. Removed redundant deep core re-export shims for moved codec/parse/container modules.
8. Moved pure FIG GUID parsing/formatting helpers into `@open-pencil/kiwi`.
9. Fixed SceneGraph `EXCLUDE` export to serialize as Kiwi/Figma `XOR`, keeping low-level codec types aligned with the Figma enum.

## Package-local test plan

`packages/kiwi/tests/**` should continue to cover:

1. **Schema runtime smoke**
   - Parse a small inline Kiwi schema.
   - Validate field numbers and enum values.
   - Compile it, encode a message, decode it back.

2. **Bundled Figma schema guard**
   - Validate the bundled `fig.kiwi` schema.
   - Assert stable high-value Figma schema facts.

3. **Protocol helpers**
   - Zstd detection.
   - Kiwi message type reading.
   - Varint parsing.
   - `fig-wire` header handling.

4. **Variable binding binary helpers**
   - Varint encode/decode coverage.
   - Figma variable ID parsing.
   - Paint/node-change variable binding byte injection.

5. **Figma message codec**
   - `initCodec()` idempotency.
   - Non-empty schema bytes.
   - Minimal message encode/decode.
   - Variable-bound paint message encoding.

6. **Container and parse helpers**
   - `buildFigKiwi()` / `parseFigKiwiChunks()` round-trip.
   - Sync/async decompression.
   - Invalid container rejection.
   - Plugin data deduplication.

7. **Dist smoke**
   - Import built package outputs from `dist`.
   - Validate schema/runtime/codec/container/parse exports.
   - Assert no `@open-pencil/core` dependency is required by package dist.

Repo-level tests under `tests/engine/io/fig/**`, `tests/engine/kiwi/**`, and Figma oracle fixtures remain in place. Package-local tests prove package isolation; repo-level tests prove OpenPencil `.fig` behavior did not regress.

## Next extraction candidates

Move only helpers that are proven scene-graph-agnostic and useful to a future `@open-pencil/fig` package. Good candidates may include small byte helpers or structural data utilities that do not depend on `SceneGraph`.

Do not move yet:

- `NodeChange` ⇄ `SceneNode` conversion.
- Instance override interpretation.
- Raw metadata preservation/invalidation policy.
- Renderer/editor fallback behavior.
- `.fig` import/export APIs that need core document policy.

## Validation commands

```sh
cd packages/kiwi && bun run check
cd ../..
bun run check
```

For targeted behavior checks, prefer focused repo tests such as:

```sh
bun test tests/engine/kiwi/schema-runtime.test.ts tests/engine/io/fig/roundtrip/basic.test.ts
```

Boolean operation export now maps SceneGraph `EXCLUDE` to the Kiwi/Figma `XOR` enum. Import remains tolerant of legacy `EXCLUDE` values in structural test data but real encoded messages should use `XOR`.
