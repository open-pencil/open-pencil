# Document contract fixtures

## `gold-input-layout.json`

Read-only Figma Plugin API capture from the original Gold Preview file, with `figma.fileKey`
verified before querying each exact node ID. Coordinates are relative to the parent. The input
instance's Tags container uses effective padding `(7.126753, 5.345065)` and spacing `3.563377`,
not the source values `(8, 6)` and `4`. The saved child positions reflect that scaling.

Initial imported geometry and the recomputed badge/placeholder positions are covered separately.
This is property evidence, not a pixel comparison or an export/reopen acceptance result. No Figma
nodes were changed during capture.

## Shared nested scale fixture

The document and browser visual tests share
[`nested-layout-scale.json`](../../../../../tests/fixtures/nested-layout-scale.json).
Its [provenance and acceptance limits](../../../../../tests/fixtures/nested-layout-scale.md)
live alongside the fixture.

## `export-contract.json`

Reduced from Figma's Save local copy canvas payload for a controlled document containing:

- A local Inter Medium text style at 14 px with 20 px line height.
- A component with a Boolean visibility property bound to its text child.
- A custom-named instance resized to 240×80 with the label hidden.
- A second instance scaled to 75%, producing 150×45 bounds.

The fixture retains eight records and eleven referenced glyph blobs (base64 encoded).
`ids` identifies the source nodes; `expected` records observations from the Figma plugin API.
Blob indexes were remapped to this fixture's blob table. Font digests are JSON byte arrays,
not numeric-key objects. Temporary oracle page/style objects were removed after capture.

The capture demonstrates modern typed `varValue` defaults and `PROP_REF` parameter bindings.
See [the contract tests](../export-contract.test.ts). It is not a complete document compatibility
fixture and does not prove every export claim in the expected data is currently implemented.
