# @lawha/kiwi

Scene-graph-agnostic Kiwi runtime utilities for Lawha.

This package owns pure Kiwi schema parsing, Figma Kiwi schema data, low-level Figma message encode/decode, raw `fig-kiwi` container helpers, and GUID formatting. Complete `.fig` archive parsing lives in `@lawha/fig`; SceneGraph integration remains outside this package.

## Credits and licensing

The schema runtime is based on [Kiwi](https://github.com/evanw/kiwi), a
schema-based binary format and JavaScript implementation by Evan Wallace.
The original Kiwi implementation is copyright (c) 2016–2023 Evan Wallace and
is licensed under the MIT License. Lawha's adapted runtime is distributed
under the terms of that license; see [`NOTICE`](./NOTICE).

```sh
bun add @lawha/kiwi
```

## Package-local checks

```sh
cd packages/kiwi
bun run check
```

Package scripts:

- `bun run test` — package-local Bun tests for schema runtime, Figma schema guards, codec, container, parse, GUID, and variable bindings
- `bun run typecheck` — type-checks `src` and tests
- `bun run build` — builds the distributable `dist` entrypoints
- `bun run check` — runs typecheck, tests, and build in sequence

## Schema runtime

```ts
import { compileSchema, parseSchema, validateSchema } from '@lawha/kiwi/schema-runtime'

const schema = parseSchema(`
message Point {
  float x = 1;
  float y = 2;
}
`)

validateSchema(schema)
const codec = compileSchema(schema)
const bytes = codec.encodeMessage({ x: 12, y: 24 })
const point = codec.decodeMessage(bytes)
```

## Figma Kiwi codec

```ts
import { createNodeChangesMessage, encodeMessage, initCodec } from '@lawha/kiwi/fig/codec'

await initCodec()

const message = createNodeChangesMessage(1, 1, [
  {
    guid: { sessionID: 1, localID: 1 },
    phase: 'CREATED',
    type: 'RECTANGLE',
    name: 'Card',
    size: { x: 320, y: 180 }
  }
])

const bytes = encodeMessage(message)
```

Boolean operation payloads use Figma's Kiwi enum names. SceneGraph `EXCLUDE` is a core-level concept and should be serialized as Kiwi `XOR` before calling the low-level codec.

## FIG Kiwi containers

```ts
import { buildFigKiwi, parseFigKiwiChunks } from '@lawha/kiwi/fig/container'

const container = buildFigKiwi(new Uint8Array([1, 2, 3]))
const chunks = parseFigKiwiChunks(container)
```

## Raw `fig-kiwi` payload decoding

```ts
import { decodeFigKiwiCanvas } from '@lawha/kiwi/fig/parse'

const decoded = decodeFigKiwiCanvas(canvasBytes)
console.log(decoded.nodeChanges.length, decoded.blobs.length)
```

Use `parseFigBuffer()` from `@lawha/fig` for complete zipped `.fig` files, including image resources. Use `@lawha/core/io` for conversion into an editable `SceneGraph`.

## GUID helpers

```ts
import { guidToString, stringToGuid } from '@lawha/kiwi/fig/guid'

const id = guidToString({ sessionID: 1, localID: 42 })
const guid = stringToGuid('1:42')
```

## Public subpaths

The package has no root entry; import each name from its subpath.

- `@lawha/kiwi/schema-runtime`
- `@lawha/kiwi/fig`
- `@lawha/kiwi/fig/codec`
- `@lawha/kiwi/fig/container`
- `@lawha/kiwi/fig/guid`
- `@lawha/kiwi/fig/parse`

`@lawha/kiwi` must not import `@lawha/core`, `#core/*`, app code, Vue code, CLI code, or MCP code.
