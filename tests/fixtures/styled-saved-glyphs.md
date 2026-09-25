# Styled saved glyph fixture

`styled-saved-glyphs.json` is a reduced SceneGraph conversion of a temporary Figma-authored text node containing `office affine` at 40 px Inter Regular. The first word has a red solid fill at 50% opacity; the second has a blue solid fill. The node was captured from Figma's Save local copy canvas payload, then the temporary page was removed.

Only typography, dimensions, fills, style runs, and saved glyph outlines/character indices are retained. This is not a full document or font binary. It contains 13 glyphs for 13 characters and **does not prove ligature coverage**.

Used by `tests/e2e/canvas/saved-glyph-visual.spec.ts`. The synthetic cluster case in that test and the renderer pixel assertions separately verify cluster-to-run selection and inherited paint.
