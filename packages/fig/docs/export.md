# Export

```text
editable SceneGraph
  +-- canonical node/resource identities
  +-- explicit owner-scoped overrides
  +-- retained source metadata + edited-field tracking
                         |
                         v
              export-scoped GUID allocation
                         |
              node records + full-path claims
                         |
             schema encoding + blobs + images
                         |
                         v
                     FIG archive
```

## Identity and references

Export must assign one identity to each node/resource and use it consistently in references.
A source GUID string is not necessarily the destination graph ID. INSTANCE_SWAP defaults and
assignments must be linked to graph nodes before export GUID resolution.

Shared styles are emitted once through the resource path, not again through ordinary scene
traversal. Sibling positions must use one consistent ordering scheme matching runtime order.
Remote style references and local style references are distinct: remote assets can require a
key/version rather than a locally assigned GUID.

## Override addressing

```text
owner + target correspondence
           |
           v
[root component key]                  self claim
[nested instance, source child]        descendant claim
[nested A, nested B, source child]     deeper descendant claim
```

Do not serialize a nested claim as only its final source GUID. Structured self overrides use
an empty target ID internally; the exporter must interpret that as the owner, not discard it.

A segment names the target record by GUID, or by its `overrideKey` when the target came from a
published library and carries one — Figma writes both forms and the reader accepts either.
`material3.fig` addresses 51,332 segments by GUID against 24 by key, while every segment in the
library-based `gold-preview.fig` is a key.

Which scene fields are claimable, which raw field each serializes to, and which are placed-space
lengths comes from one registry (`instance-overrides/fields.ts`); materialization records
claims and export serializes them from the same table.

A descendant `size` claim has no effect in Figma, which does not allow resizing a layer inside
an instance: no size claim in `gold-preview.fig`, `material3.fig` or `nuxtui.fig` targets a
descendant that is not an instance, and the ones that target a nested instance restate that
instance's own size. OpenPencil permits the edit, so the writer records it and the reader
restores it; Figma keeps the layer at its component's size on open.

A paint colour alias lives inside the paint, not in the node's parameter map. A `fills` or
`strokes` claim is therefore written with each paint's `colorVar`, and a
`boundVariables/fills/N/color` override is serialized as that paint claim rather than as a
consumption entry, which has no field for it. Reading a claimed paint records its binding claim
as well, so a later component sync cannot restore the component's variable.

## Values and layout

- Root size claims and placed sizes occupy different coordinate spaces when uniformly scaled.
- Do not apply the root-size scaling rule indiscriminately to padding or other fields.
- Preserve explicit sizing/grow/alignment claims, not just text or final rectangles.
- Untouched layout metadata retains omission and implicit-size semantics.
- Edited fields export current values rather than stale retained metadata.
- Text sizing is explicit state. Being inside auto-layout does not justify forcing `HEIGHT`.

These rules are supported by focused tests, but coordinate-space handling across all nested
scaling and layout combinations is not complete.

```text
Root size claim       Uniform scale       Placed node size
100 x 40              0.5                 50 x 20
     |                                         |
     +-- export in root-claim space            +-- export as node.size

Writing 50 x 20 into both places can apply the scale twice.
```

This example describes root dimensions only. Padding and other fields require their own
coordinate-space contracts; do not apply the same division to every numeric property.

## Component properties and parameters

Current Figma records use typed `varValue` data for definitions and assignments, and `PROP_REF`
entries in `parameterConsumptionMap` for bindings. Older value/reference forms also exist.
Writing only the older fields can produce visible content with nonfunctional property controls.

Variable bindings and component-property bindings share parameter maps. Combining them must
preserve both; one must not replace the whole map containing the other.

## Validation boundary

An archive that encodes successfully is not necessarily interpreted correctly by Figma. A
writer and reader can agree on the same mistake. Require both record-level regressions and
[external reopen checks](./validation.md), including actual property actions after import.

**Known limitations:** explicit-name persistence, complete style associations, all override
fields, and structural editing/export interactions remain acceptance gaps. Do not present
selected passing properties as complete editable-document compatibility.

## Implementation and tests

- [Node-change serialization](../src/node-change/export/node.ts)
- [Override claims](../src/node-change/export/override-claims.ts)
- [Export context and identity allocation](../src/node-change/export/context.ts)
- [Property/layout conversion](../src/node-change/serialize.ts)
- [Archive assembly](../src/archive.ts)
- [Core export orchestration](../../core/src/io/formats/fig/export.ts)
- [Figma-authored contract fixture](../tests/document/fixtures/README.md)
- [Self-size export](../tests/document/self-size-export.test.ts)
- [Edited layout export](../tests/document/layout-edit-export.test.ts)
- [Shared-style uniqueness](../tests/document/shared-style-export.test.ts)
- [Full-document editing round trip](../tests/document/gold-edit.test.ts)
- [Instance paint alias round trip](../../../tests/engine/io/fig/roundtrip/variables.test.ts)
