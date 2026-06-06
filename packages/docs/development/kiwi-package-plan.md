# `@open-pencil/kiwi` extraction plan

`@open-pencil/kiwi` should be the first file-format package split after `@open-pencil/dom-css`. The first migration must keep `.fig` import/export behavior inside `@open-pencil/core` while moving only scene-graph-agnostic Kiwi runtime code behind a standalone package boundary.

## Scope boundary

### Move first

| Current path | Target path | Why it belongs in `@open-pencil/kiwi` | Preconditions |
|---|---|---|---|
| `packages/core/src/kiwi/schema-runtime/**` | `packages/kiwi/src/schema-runtime/**` | Pure Kiwi schema parsing, validation, binary encode/decode, byte-buffer utilities. Imports only local runtime modules. | Add package-local schema runtime tests and dist smoke. |
| `packages/core/src/kiwi/fig/codec/schema/fig.kiwi` | `packages/kiwi/src/fig/schema/fig.kiwi` | Static Figma Kiwi schema text. It is data, not SceneGraph policy. | Keep raw-md bundler support in the new package build. |
| `packages/core/src/kiwi/fig/codec/schema/index.ts` | `packages/kiwi/src/fig/schema.ts` | Parses and validates the static schema. Currently only depends on schema runtime plus raw schema text. | Rewrite imports to package-local runtime paths. |
| `packages/core/src/kiwi/fig/codec/protocol.ts` | `packages/kiwi/src/fig/protocol.ts` | Low-level Figma multiplayer/Kiwi container byte inspection. No SceneGraph dependency. | Add fixtures for message-type and compression detection. |
| `packages/core/src/kiwi/fig/codec/variable-bindings.ts` | `packages/kiwi/src/fig/variable-bindings.ts` | Low-level variable binding binary encode/decode helper. It should not need SceneGraph. | Replace `#core/bytes/hex` / `#core/types` imports with local helpers/types. |
| `packages/core/src/kiwi/fig/codec/index.ts` | `packages/kiwi/src/fig/codec.ts` | Encodes/decodes Figma Kiwi messages. Mostly schema/runtime/protocol logic. | Remove `#core/color` dependency or make color parsing caller-owned; replace core shared types with local exported structural types. |

### Keep in `@open-pencil/core` for now

| Current path | Reason it stays |
|---|---|
| `packages/core/src/kiwi/fig/import.ts` | Creates `SceneGraph`, imports variables/components/pages, applies OpenPencil source metadata. |
| `packages/core/src/kiwi/fig/lazy-import.ts` | Stores lazy import context in `SceneGraph` weak maps. |
| `packages/core/src/kiwi/fig/node-change/**` | Converts between Figma `NodeChange` records and OpenPencil `SceneNode`, text, vector, paint, font, and layout types. This is `.fig` policy, not raw Kiwi. |
| `packages/core/src/kiwi/fig/instance-overrides/**` | Resolves Figma component/instance override semantics into `SceneGraph`. |
| `packages/core/src/kiwi/fig/parse/**` | `parse/core.ts` can move later to `@open-pencil/fig`; `transfer.ts` and `worker.ts` serialize `SceneGraph`, so they stay until `.fig` package extraction. |
| `packages/core/src/kiwi/fig/container/**` | `.fig`/Kiwi container framing policy. Move later with `@open-pencil/fig`, unless a pure byte-container helper is split out deliberately. |
| `packages/core/src/kiwi/fig/file.ts` | Re-export of core `.fig` I/O. |
| `packages/core/src/io/formats/fig/**` | App/CLI-facing `.fig` read/write policy and renderer-backed export behavior. |

## Dependency blockers to remove before moving

- `fig/codec/index.ts` imports `parseColor` from `#core/color` for convenience factories. Options:
  - remove string color parsing from the low-level package, or
  - accept a caller-supplied `parseColor` option, or
  - move only structural encode/decode first and leave convenience constructors in core.
- `fig/codec/index.ts` and `variable-bindings.ts` import `Color`, `GUID`, `Matrix`, and `Vector` from `#core/types`. The Kiwi package should define minimal structural types locally and let core adapt them.
- `variable-bindings.ts` imports `hexToBytes` from `#core/bytes/hex`. Copy a tiny local helper or expose it from the Kiwi package; do not depend on core.
- Raw `.kiwi` loading currently relies on the root raw markdown/schema tooling. The new package build must prove raw schema import works from `packages/kiwi` in build and smoke tests.

## Initial package shape

```text
packages/kiwi/
  package.json
  tsconfig.json
  tsconfig.test.json
  tsdown.config.ts
  scripts/smoke-dist.ts
  src/
    index.ts
    schema-runtime/
    fig/
      codec.ts
      protocol.ts
      schema.ts
      schema/fig.kiwi
      variable-bindings.ts
      types.ts
  tests/
    schema-runtime.test.ts
    fig-schema.test.ts
    fig-codec.test.ts
    protocol.test.ts
    variable-bindings.test.ts
```

Public exports should stay narrow at first:

```json
{
  ".": "./dist/index.js",
  "./schema-runtime": "./dist/schema-runtime/index.js",
  "./fig": "./dist/fig/index.js"
}
```

`@open-pencil/core/kiwi` should keep compatibility re-exports during the first migration so app, CLI, MCP, and external consumers do not need to change immediately.

## Package-local test plan

Add these tests in `packages/kiwi/tests/**` before moving production callers:

1. **Schema runtime smoke**
   - Parse a small inline Kiwi schema.
   - Validate field numbers and enum values.
   - Compile it, encode a message, decode it back.

2. **Bundled Figma schema guard**
   - Validate the bundled `fig.kiwi` schema.
   - Assert stable high-value facts already covered in `tests/engine/kiwi/schema-runtime.test.ts`:
     - definition count is `605`
     - `NodeChange` exists
     - `InteractiveSlideElementChange` exists
     - `Paint.colorVar` field number is `21`
     - `NodeChange.pageType` field number is `397`
     - `VariableField.OVERRIDDEN_SYMBOL_ID` enum value is `37`

3. **Protocol helpers**
   - `isZstdCompressed()` returns true for Zstd magic bytes and false for Kiwi payload bytes.
   - `getKiwiMessageType()` reads a message type from a minimal encoded payload.
   - Malformed payloads fail predictably without throwing unexpected internal errors.

4. **Variable binding binary helpers**
   - Varint encode/decode round-trips representative values: `0`, `1`, `127`, `128`, `255`, `16384`.
   - GUID hex/byte conversion round-trips a known Figma GUID.
   - Color variable binding encode output stays byte-stable for a known fixture.

5. **Figma message codec**
   - `initCodec()` is idempotent.
   - `getSchemaBytes()` returns non-empty stable schema bytes.
   - A minimal `FigmaMessage` encode/decode round-trips.
   - A `NodeChange` with variable bindings uses the custom node-change path and decodes back to equivalent data.

6. **Dist smoke**
   - Import `@open-pencil/kiwi` built output from `dist`.
   - Validate schema, initialize codec, encode/decode one minimal message.
   - Assert no import of `@open-pencil/core` is required by the package dist.

Repo-level tests under `tests/engine/io/fig/**`, `tests/engine/kiwi/serialize-fixes/**`, and Figma oracle fixtures should remain in place. Package-local tests prove package isolation; repo-level tests prove OpenPencil `.fig` behavior did not regress.

## Migration sequence

1. Add `packages/kiwi` with copied runtime/schema files and package-local tests, but do not update production imports yet.
2. Make `@open-pencil/core/kiwi` re-export from `@open-pencil/kiwi` for schema runtime and codec-only APIs.
3. Update internal core imports that only need schema runtime or codec APIs to public `@open-pencil/kiwi` exports.
4. Keep `.fig` import/export, node-change conversion, and instance override policy in core until `@open-pencil/fig` exists.
5. Run:

```sh
cd packages/kiwi && bun run check
bun test tests/engine/kiwi/schema-runtime.test.ts tests/engine/io/fig/roundtrip/basic.test.ts
bun run check
```

6. Only after the package is stable, start the `@open-pencil/fig` split for `.fig` container/read/write and SceneGraph conversion policy.

## Do not do yet

- Do not move `NodeChange` ⇄ `SceneNode` conversion into `@open-pencil/kiwi`.
- Do not make `@open-pencil/kiwi` depend on `@open-pencil/core`.
- Do not widen app/CLI imports to private package source paths.
- Do not guess or rewrite Figma schema fields during the split.
- Do not remove `@open-pencil/core/kiwi` compatibility exports in the first migration.
