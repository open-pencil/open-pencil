## Context

OpenPencil collaboration stores scene graph nodes in a shared Yjs map. The current implementation serializes every object-valued `SceneNode` property with `JSON.stringify()`, then reconstructs props by parsing only keys in `YJS_JSON_FIELDS`. The allow-list omits required or renderer-sensitive fields such as `source`, `fillGeometry`, and `strokeGeometry`. During a two-person session, a remote-created shape can therefore arrive with invalid runtime values and crash the receiving peer in `clearEditedSourceMetadata()` or `geometryBlobBounds()`.

Evoton research packs:

| Pack | Relevant recommendation |
|---|---|
| `open-pencil-collab-yjs-geometry-source-metadata` | Fix the Yjs node codec boundary; keep source metadata and geometry guards as defense in depth; defer MQTT fallback. |
| `open-pencil-collab-yjs-node-codec-impact` | Use an explicit collab-safe schema, preserve source metadata semantics, explicitly handle typed arrays, preserve suppress flags, keep codec graph-only, and add round-trip tests. |

The split-pane feature keeps graph/document state shared while pane-local page, selection, hover, cursor, viewport, and render state stay outside collaboration. The collab codec must operate only on shared graph node/resource state.

## Goals / Non-Goals

**Goals:**

- Encode and decode Yjs node props through an explicit collab-safe schema instead of a drifting JSON parse allow-list.
- Preserve valid runtime `SceneNode` invariants for remote-created and remote-updated nodes.
- Restore `Uint8Array` geometry payloads when geometry is synchronized.
- Preserve source metadata shape so `SceneGraph.updateNode()` and `.fig` import/export metadata semantics remain valid.
- Preserve `fills[].imageHash` and the existing separate `yimages` binary resource synchronization path.
- Preserve suppress flag behavior so remote Yjs changes do not echo back as local graph transactions.
- Keep defensive source metadata and geometry guards as crash containment, not as the primary correctness mechanism.
- Add focused unit tests that exercise the codec and Yjs graph application without requiring Trystero networking.

**Non-Goals:**

- Do not change Trystero/MQTT signaling, broker fallback, room discovery, or reconnect policy.
- Do not synchronize split-pane pane-local view state.
- Do not redesign Yjs conflict resolution or introduce a new CRDT structure for individual node fields.
- Do not change public file format semantics or intentionally drop imported Figma raw metadata.

## Decisions

### Decision: introduce an explicit node codec module

Add `src/app/collab/node-codec.ts` with focused functions such as:

- `encodeNodeForYjs(node: SceneNode): Record<string, unknown>`
- `decodeNodeFromYjs(ynode: Y.Map<unknown>): Partial<SceneNode>`
- small normalizers for `SourceMetadata`, `GeometryPath[]`, and JSON-safe object fields.

Rationale: the current `YJS_JSON_FIELDS` allow-list couples encoding and decoding poorly. A codec module centralizes the schema and makes each included field auditable.

Alternative considered: add `source`, `fillGeometry`, and `strokeGeometry` to `YJS_JSON_FIELDS`. Rejected because it would not restore `Uint8Array` geometry blobs and would keep future field drift likely.

### Decision: encode object fields intentionally, not automatically

The codec should include shared graph fields that peers need for visual/document consistency. It must not blindly sync every property if that would propagate transient, import-only, or large fields without a decision.

Initial field policy:

| Field group | Policy |
|---|---|
| Identity/tree (`id`, `type`, `parentId`, `childIds`, `name`) | Include; remote create/update must preserve node identity, parent/page placement, and child ordering. |
| Geometry/layout/style primitives | Include JSON-safe primitive values as-is. |
| Visual object arrays (`fills`, `strokes`, `effects`, `styleRuns`, `fontVariations`, `fontFeatures`, `grid*`, component/variant/plugin arrays) | Include as JSON-compatible values with legacy string fallback. |
| `vectorNetwork` | Include as JSON-compatible object with legacy string fallback. |
| `source` | Include and decode to a valid `SourceMetadata` shape. Missing/partial source is materialized using default source metadata because `SceneNode.source` is a required runtime invariant. Existing imported metadata is preserved when present. |
| `fillGeometry` / `strokeGeometry` | Include only valid entries; encode `commandsBlob` using the typed-array envelope described below and decode back to `Uint8Array`. Malformed entries are skipped. |
| `textPicture` | Do not sync as graph authority; decode to `null` because it is a renderer cache that can be regenerated. |
| `figmaDerivedTextGlyphs` | Preserve when JSON-compatible or typed-array-normalizable; otherwise omit/null rather than corrupting runtime text rendering. |
| Pane-local editor state | Exclude entirely. |

Typed-array envelope:

```ts
type EncodedUint8Array = { __type: 'Uint8Array'; data: number[] }
```

The decoder also accepts legacy JSON strings for fields that were previously stringified, at minimum: `fills`, `strokes`, `effects`, `styleRuns`, `fontVariations`, `fontFeatures`, `vectorNetwork`, `source`, `fillGeometry`, `strokeGeometry`, `figmaDerivedLayout`, `figmaDerivedTextGlyphs`, `overrides`, component metadata, `boundVariables`, `pluginData`, and `pluginRelaunchData`.

Rationale: remote graph state must remain usable by renderer, layout, IO, and property panels, but the codec should make field decisions explicit.

### Decision: keep `yimages` as the binary resource path

Image bytes should continue to sync via the existing `yimages` map. The node codec only needs to preserve `fills[].imageHash` and other fill metadata so `syncNodeToYjs()` can populate `yimages` and receivers can resolve image fills.

Rationale: image bytes are already separated from node props. Mixing them into the node codec would increase payload size and broaden risk.

### Decision: preserve graph/Yjs suppress semantics

The existing `suppressGraphSync` and `suppressYjsEvents` behavior must remain intact. The codec changes the payload shape, not the observer transaction model.

Rationale: Evoton identified event feedback loops as a high regression risk. Remote updates must not echo back as new local writes.

### Decision: graph-only collaboration boundary

The codec must only operate on shared `SceneGraph` node data and graph resources. Split-pane state remains local to each editor session/pane.

Rationale: same-document split panes intentionally share graph state while independent panes manage page/viewport/selection/cursor/render state locally.

## Risks / Trade-offs

- [Risk] Dropping or defaulting `source.fig` incorrectly can reduce `.fig` export fidelity. → Mitigation: normalize shape without deleting existing metadata; add tests for source metadata preservation/defaulting.
- [Risk] JSON cannot round-trip `Uint8Array` geometry payloads. → Mitigation: use explicit typed-array encoding/decoding and test `commandsBlob instanceof Uint8Array` after decode.
- [Risk] Blindly syncing all fields can propagate derived or large data unnecessarily. → Mitigation: centralize field handling in the codec and document sensitive field behavior in tests.
- [Risk] Defensive guards can hide upstream corruption. → Mitigation: tests assert valid decoded remote payloads, not only no crashes.
- [Risk] Remote update application can create Yjs feedback loops. → Mitigation: preserve suppress flags and test that apply-from-Yjs does not call local sync recursively.
- [Risk] Split-pane render scheduling may amplify remote update churn. → Mitigation: keep codec graph-only and test/manual-check remote create with split panes open.
- [Risk] MQTT warnings remain visible. → Mitigation: keep signaling fallback out of scope and document it as a separate follow-up.

## Migration Plan

1. Add the codec and tests without changing external document format.
2. Wire `syncNodePropsToYMap()` and Yjs apply paths through the codec.
3. Keep backward tolerance for already-stringified Yjs values during the session by accepting both encoded objects and legacy JSON strings where feasible.
4. Run focused unit tests, pane tests, `bun run check`, and OpenSpec validation.
5. Manual test: two peers in one room, remote create/update shape, optional split panes open on the receiving peer.

Rollback is straightforward: revert the codec wiring and return to the prior allow-list behavior, though that reintroduces the remote shape crash.

## Open Questions

- Should derived Figma geometry always sync, or should the codec omit invalid derived geometry for locally-created non-vector shapes? Initial implementation should preserve valid payloads and skip only malformed entries.
- Should the codec log skipped malformed fields in development? This may be useful but is not required for the first fix.
