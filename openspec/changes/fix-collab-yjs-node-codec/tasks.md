## 1. Codec Design and Wiring

- [x] 1.1 Add `src/app/collab/node-codec.ts` with explicit encode/decode entrypoints for Yjs node payloads.
- [x] 1.2 Define the concrete collab field policy in the codec, including included graph fields, excluded pane/cache fields, and legacy string fallbacks.
- [x] 1.3 Move node object field handling out of `YJS_JSON_FIELDS` and into the codec.
- [x] 1.4 Update `syncNodePropsToYMap()` and Yjs apply paths to use the codec while preserving public helper behavior for tests.
- [x] 1.5 Preserve existing `suppressGraphSync` and `suppressYjsEvents` transaction behavior.

## 2. Field Normalization

- [x] 2.1 Normalize missing or partial source metadata to a valid `SourceMetadata` shape.
- [x] 2.2 Preserve imported Figma raw metadata when valid source metadata is present in the payload.
- [x] 2.3 Encode and decode `fillGeometry` and `strokeGeometry` command blobs with the `{ __type: 'Uint8Array', data: number[] }` envelope.
- [x] 2.4 Preserve JSON-safe graph fields including fills, strokes, effects, style runs, vector networks, layout metadata, and component/instance metadata needed by shared graph state.
- [x] 2.5 Decode legacy JSON-string payloads for supported object fields.
- [x] 2.6 Preserve image fill `imageHash` values and keep image bytes on the existing `yimages` path.

## 3. Defensive Boundaries

- [x] 3.1 Keep renderer geometry guards that skip malformed command blobs without throwing.
- [x] 3.2 Harden source metadata clearing against missing or partial metadata without changing normal imported metadata clearing semantics.
- [x] 3.3 Keep collaboration payloads graph-only and avoid serializing pane-local split canvas state.

## 4. Regression Coverage

- [x] 4.1 Add codec unit tests for object field round-trips and legacy JSON string compatibility.
- [x] 4.2 Add tests for source metadata defaulting and imported metadata preservation.
- [x] 4.3 Add tests for `Uint8Array` geometry command blob round-trips and malformed geometry skipping.
- [x] 4.4 Add tests for image fill references, image-before-bytes ordering, and vector network round-trips.
- [x] 4.5 Add tests or a local Yjs simulation proving remote graph application does not echo back as an immediate local sync transaction and local graph sync still works afterward.
- [x] 4.6 Add tests that remote create preserves node id, parent id, page/frame containment, and child ordering.

## 5. Validation

- [x] 5.1 Run focused collab/codec tests.
- [x] 5.2 Run `bun run check`.
- [x] 5.3 Run `openspec validate fix-collab-yjs-node-codec --strict`.
- [x] 5.4 Manually test a two-peer session where one peer creates a shape and the other peer receives it, including with split panes open if feasible.
