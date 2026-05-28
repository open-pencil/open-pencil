## Why

Two-person collaboration currently corrupts remote-created node payloads: object-valued `SceneNode` fields are serialized into Yjs as JSON strings, but only a small allow-list is parsed back. When one peer creates a shape, another peer can receive invalid `source`, `fillGeometry`, or `strokeGeometry` values and crash in source metadata clearing or geometry rendering.

Evoton studies `open-pencil-collab-yjs-geometry-source-metadata` and `open-pencil-collab-yjs-node-codec-impact` trace the issue to the collaboration node codec boundary and identify impact risks across import/export metadata, typed geometry payloads, image resources, graph event feedback, and split-pane graph sharing.

## What Changes

- Replace the drifting `YJS_JSON_FIELDS` parse allow-list with an explicit collaboration-safe node codec for Yjs graph synchronization.
- Preserve valid shared `SceneNode` graph state across peers, including source metadata, vector networks, style runs, image fills, and typed geometry payloads.
- Normalize missing or malformed source metadata so remote updates cannot crash `SceneGraph.updateNode()` metadata clearing.
- Keep defensive geometry guards as crash containment, while restoring valid typed payloads at the collab boundary.
- Add focused regression coverage for remote-created node round-trips and guardrails against graph/Yjs feedback loops.
- Defer Trystero/MQTT signaling fallback work; broker handshake warnings are a separate availability concern and not the root cause of the node payload crashes.

## Capabilities

### New Capabilities
- `collab-yjs-node-codec`: Collaboration-safe encoding and decoding of shared scene graph node data through Yjs.

### Modified Capabilities

None.

## Impact

- `src/app/collab/yjs-sync.ts`: node property serialization/deserialization, remote create/update application, image resource sync interactions, suppress flag behavior.
- New collab codec module under `src/app/collab/` for explicit field handling and typed-array restoration.
- `src/constants.ts`: remove or stop using the fragile `YJS_JSON_FIELDS` allow-list for node props.
- `packages/core/src/scene-graph/source-metadata.ts`: tolerate missing/partial source metadata without losing imported Figma metadata semantics.
- `packages/core/src/geometry.ts` and `packages/core/src/canvas/shapes.ts`: retain defensive geometry validation as defense in depth.
- Tests under `tests/engine/` for codec round-trips, remote graph application, source metadata normalization, typed geometry blobs, image references, and no-echo sync behavior.
