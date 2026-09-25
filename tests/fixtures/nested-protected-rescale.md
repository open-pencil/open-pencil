# Protected binding during definition rescale

Native Figma clone of the already-rescaled outer component has a placed instance at scale0.25.
Its nested left padding is explicitly bound to the direct token12, giving padding3, nested
width10.5, and outer width20.5. Doubling the definition child's scale changes inherited geometry:
outer28×14, nested18×14, right padding5. Explicit left padding stays3.

Changing the direct token12→16 then gives left4, nested19, and outer29. It is restored12.
`nested-protected-rescale.json` contains the native observations. This confirms that the placed
binding retains its declaring-owner units, not the newly scaled definition's units.

Engine regression tests reproduce these values through the editor scheduler and verify a local
edited export/reimport. Existing synchronization already preserves this case; no production
change was necessary.

The protected case is also exported and reopened in Figma: geometry remains outer28×14,
nested18×14, and padding3/5. Its decoded sRGB RGBA raster matches the independent native
capture exactly at8× (224×112), saved as `nested-protected-rescale-figma.png`.
Multiple independently inherited binding fields, undo, and transitive dependencies are separate
contracts.
