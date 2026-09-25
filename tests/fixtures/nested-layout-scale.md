# Nested layout scale

`nested-layout-scale.json` contains controlled Figma save payloads before and after editing a
nested scaled auto-layout instance. The inner component uses horizontal padding 10, vertical
padding 4, spacing 6, and a 20×20 child. Its instance is scaled by 0.5 inside an outer component
with horizontal padding 20 and spacing 8. The placed outer instance is also scaled by 0.5.

The `before` snapshot has effective outer padding 10 and inner padding 2.5. In `edited`, Figma's
Plugin API sets outer padding to 13 and inner padding to 7. The save stores owner-relative
padding overrides of 26 and 14 respectively, while the placed root record stores padding 13.
Effective widths are 30/10 before and 37.5/14.5 after (outer/inner). The rectangle remains 5×5.

Only the controlled page and its five scene records are retained. A document root is supplied
by the tests. Edit attribution is omitted, and referenced geometry blobs are remapped to the
fixture's base64 table. The temporary page was removed after capture.

Tests cover interpretation, layout recomputation, editor undo/redo, local edited re-encoding,
and a browser canvas snapshot of the interpreted before/edited trees at 6× zoom. The snapshot
projects only geometry and paint fields; it does not exercise browser file loading. This fixture
does not by itself establish exported-file reopening or pixel parity in Figma.

## Independent edited export acceptance

Starting from `before`, the editor changes outer paddingLeft to 13 and nested paddingLeft to 7,
then exports a new `.fig` archive. Figma reopens that archive with outer/nested widths 37.5/14.5,
paddingLeft 13/7, and a 5×5 rectangle at nested position (7, 1). `nested-layout-scale-figma.png`
is the reopened root's 300×56 PNG, exported through Figma's Plugin API at scale 8. The headless
raster test compares decoded sRGB RGBA pixels at the same size without fuzz or resampling.
The comparison has zero differing pixels.

This acceptance is limited to this controlled geometry/paint fixture. It does not cover text,
live variable updates, or general instance fidelity. Figma renames the custom-named root to its
component name on reopening; instance-name preservation remains a separate failing contract.
