# Protected binding during definition rescale

Native Figma clone of the already-rescaled outer component has a placed instance at scale 0.25.
Its nested left padding is explicitly bound to the direct token 12, giving padding 3, nested
width 10.5, and outer width 20.5. Doubling the definition child's scale changes inherited geometry:
outer 28×14, nested 18×14, right padding 5. Explicit left padding stays 3.

Changing the direct token 12→16 then gives left 4, nested 19, and outer 29. It is restored to 12.
`nested-protected-rescale.json` contains the native observations. This confirms that the placed
binding retains its declaring-owner units, not the newly scaled definition's units.

Engine regression tests reproduce these values through the editor scheduler and verify a local
edited export/reimport. Existing synchronization already preserves this case; no production
change was necessary.

The protected case is also exported and reopened in Figma: geometry remains outer 28×14,
nested 18×14, and padding 3/5. Its decoded sRGB RGBA raster matches the independent native
capture exactly at 8× (224×112), saved as `nested-protected-rescale-figma.png`.
Multiple independently inherited binding fields, undo, and transitive dependencies are separate
contracts.
