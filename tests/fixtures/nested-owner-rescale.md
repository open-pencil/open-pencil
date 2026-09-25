# Rescaling a placed owner

The source is `nested-binding-ownership-records.json`. Both root and nested right padding
are bound to the direct token, as in `nested-binding-authoring.md`. A native Figma clone
is rescaled by 0.5: outer size becomes 16.5×3.5, nested width 8.5, and the root right and
nested left/right padding all become 3.

OpenPencil performs the same binding assignments and API rescale, then exports and reopens
in Figma. `nested-owner-rescale.json` records matching geometry. Changing the reopened
direct token from 12 to 16 gives outer width 19.5, nested width 10.5, and padding 4.
The token is restored to 12 afterward.

`nested-owner-rescale-figma.png` is the independent native clone export at 8× (132×28).
The reopened Figma export and OpenPencil headless rendering both match its decoded sRGB
RGBA pixels exactly. A separate browser snapshot covers before/after graph geometry.

Local tests additionally cover enlargement back to unit occurrence scale, literal padding
claims, continued token reactivity, and preservation of derived geometry as snapshots
rather than new authored descendant size claims. Those additional cases are local evidence,
not independently captured Figma acceptance.

This establishes rescaling the placed owner, not independently rescaling nested instances,
reparenting, rescaled typography, structural edits, or all unloaded-page lifecycle behavior.
