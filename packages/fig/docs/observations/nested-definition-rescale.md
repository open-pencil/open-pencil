# Definition-level rescale propagation

The native fixture clones the outer component definition, creates a placed instance at scale
0.25, then doubles the scale of the nested instance inside the definition. Before the edit,
outer size is 16.25×3.5 and nested size 6.25×3.5, with left/right padding 2.5/1.25. Afterward,
outer size is 22.5×7 and nested size 12.5×7, with left/right padding 5/2.5.

OpenPencil imports the inherited-expression variant of `nested-binding-ownership-records.json`,
halves the placed owner's scale, and doubles the definition child's scale. The editor's queued
component synchronization updates occurrence coordinate scales as well as numeric properties.
Export reopened in Figma retains matching geometry. Token 20→40 gives nested left 10, nested
width 17.5, and outer width 27.5. The token is restored to 20.

`nested-definition-rescale.json` records native before/after, reopen, and token observations.
`tests/fixtures/nested-definition-rescale-figma.png` is the native after-edit export at 8× (180×56). The engine
renderer matches exact decoded sRGB RGBA pixels. Engine tests separately exercise editor
scheduling, local edited re-encoding, token updates, and coordinate metadata.

This is not coverage of arbitrary scale overrides, swaps, definition-rescale undo, reparenting,
transitive multi-definition edits, or typography. Native Plugin API restrictions on directly
rescaling placed descendants remain described in `nested-rescale-restrictions.md`.
