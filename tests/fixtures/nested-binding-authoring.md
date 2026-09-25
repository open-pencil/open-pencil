# New binding authoring

The source is `nested-binding-ownership-records.json`. Its placed outer occurrence and nested
instance both have a newly declared `paddingRight` binding to the direct token (value 12).

Independent Figma Plugin API assignment gives paddingRight 6 on both nodes, nested width 17,
and outer width 33. An OpenPencil Figma API export reopened in Figma retains those values and
both aliases. Geometry and bound-variable captures are in `nested-binding-authoring.json`.

`nested-binding-authoring-figma.png` is an independent Figma export of the native assignment,
at scale 8 (264×56). The headless authored-binding regression compares exact decoded sRGB RGBA
pixels, without resampling or tolerance.

## Component-edit acceptance

On the reopened file, changing the Inner main component's paddingTop from 4 to 8 produces
nested paddingTop 2 and height 8. Both direct aliases remain live and paddingRight stays 6.
The source property is restored to 4 after capture. `document/binding/authoring.test.ts` now
passes the independently captured value 2, preserves the bindings, and covers undo/redo.
`nested-component-scale-figma.png` is the independent 264×64 Figma raster at 8×; headless pixels
match exactly. A browser snapshot also covers the before/after geometry projection.

An OpenPencil export after the component edit reopens in Figma with root size 33×8, nested
paddingTop 2, paddingRight 6, and both aliases intact. This establishes this component-edit
contract, not complete typography, rescale/export, reparenting, or structural lifecycle acceptance.

The source archive also encodes the canonical nested inherited padding as a MULTIPLY expression
(constant 0.5 × alias), rather than a plain alias. The pure-inheritance undo test deliberately
removes that expression to isolate assignment provenance; it does not establish expression support.
