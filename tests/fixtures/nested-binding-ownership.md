# Nested binding ownership oracle

`nested-binding-ownership.json` records Figma Plugin API observations in a controlled document
with a 0.5-scaled inner instance inside a 0.5-scaled outer instance. The inner component has a
padding variable binding. The observed instance is identified by its exact node ID throughout.

| Binding declaration                                                   | Token | Effective nested padding |
| --------------------------------------------------------------------- | ----: | -----------------------: |
| Inherited from the inner component                                    |    20 |                        5 |
| Assigned directly to the nested instance through the outer occurrence |     8 |                        4 |
| Same direct binding after a token edit                                |    12 |                        6 |

The direct assignment uses the declaring outer instance's scale, not the compounded inner
scale. Figma reports the explicit alias in the nested node's `boundVariables`; the inherited
scaled binding is absent from that Plugin API projection despite remaining a live dependency.
The token values are the values supplied to the variable setters immediately before capture.
The experiment modifies only a disposable imported document, not the original Gold document.

`nested-binding-ownership-records.json` contains the 12 records and three base64 blobs from
Figma's local-save canvas payload after the direct token reaches 12. Top-level edit attribution
is omitted. The binding is a `parameterConsumptionMap` entry on the outer instance's
`symbolOverrides` path `[1:5]`; the outer record retains `uniformScaleFactor: 0.5`.

The document tests now retain the explicit alias, apply its declaring-owner scale, and preserve
it through token editing, undo, and local re-encoding. A synthetic extension binds an unrelated
inherited field to the same variable: its multiplier remains 0.25 while the direct field uses 0.5.
Interpretation uses recorded declarations and paths, not equal values or node names.

## Independent re-export acceptance

The interpreted document is edited, undone, and re-encoded, then reopened in Figma. The nested
instance retains its explicit variable alias and padding 6, with nested/outer widths 13.5/33.5.
Changing the token from 12 to 16 in reopened Figma changes padding to 8 and widths to 15.5/35.5.
The token is restored to 12 before capturing `nested-binding-ownership-figma.png`: a 268×56 PNG
at scale 8. A headless raster regression edits the imported token to 16 and back to 12, then
compares exact decoded sRGB RGBA pixels with this independent image, without fuzz or resampling.

This establishes the captured imported declaration's behavior, not all new binding assignments
through OpenPencil's APIs, scaled text metrics, or general file parity.
