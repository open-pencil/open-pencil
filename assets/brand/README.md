# OpenPencil brand sources

- `mark.svg` is the teal pencil-P master: a long pointed stem, contrasting teal blocks, a faint clipped pixel grid, and white editing handles with blue borders (`#005CFF`). The square sits at the top-left; the circle sits on the outer curve.
- `mark-micro.svg` renders at 16px and preserves the main P's geometry and proportions. Its square and circular handles are enlarged for small sizes, with the circle slightly larger than the square. It has no grid.
- Both use the same tight `28 28 228 228` viewBox. Keep the P geometry aligned between masters; optical adjustments belong to the handles, not the letter's proportions.
- Both use real transparent counters and no white outline. Preserve the `data-part` attributes used for derived dark and monochrome artwork.
- Dark artwork has its own brighter teal palette, lighter blue borders, soft-white handle centers, and a subtler grid. Monochrome artwork omits the grid.

Edit these SVGs, not generated files. Platform backgrounds, padding, and dark colors live in `tools/generate/brand/src/config.ts`. The approved main colors are defined by the SVG artwork. The official app-icon variant puts the light-palette mark on an ivory (`#F5F5EF`) rounded tile that fills the image, with transparency only at the rounded corners. Native desktop assets retain their platform-specific outer margin. Desktop icons, any-purpose PWA icons, and larger in-app branding share this composition. The tile stays ivory in both themes; use `BrandMark` with `variant="app-icon"` for larger placements. The editor header uses a 24px tile. Favicons use the same tile with the optical micro master inside, in both browser themes. Generated `brand/app-icon.svg` and `brand/app-icon-1024.png` are suitable for profile images. Apple Touch keeps an opaque square for platform rounding; maskable artwork stays opaque and inside the central 80%-diameter safe circle.

## Generation

```sh
bun run generate:icons                    # All targets
bun run generate:icons --target web       # App/browser/PWA
bun run generate:icons --target docs      # Documentation
bun run generate:icons --target desktop   # Native PNG/ICO/ICNS
bun run generate:icons --force            # Ignore the content cache
bun run check:icons                       # Fresh generation, contracts, reproducibility, types
bun test tools/generate/brand/tests
```

Generation is local using pinned RealFaviconGenerator/Sharp and Tauri versions; no hosted generator or credentials are needed. Generated assets and the cache are ignored by Git. Only the two artwork masters, settings, code, tests, and the normal Playwright visual baseline are tracked.

Vite ensures web assets before app dev/build. VitePress ensures docs assets before docs dev/build. Storybook prepares the assets for its stories. Tauri's dev/build hooks prepare native icons before compilation. Direct Cargo commands bypass those hooks: run `bun run generate:icons --target desktop` before `cargo check` or `cargo build` on a fresh checkout. CI's native-contract job does this explicitly. No icon generation runs in the shipped application.

Outputs are owned by `tools/generate/brand/src/config.ts`: `public/brand/`, `packages/docs/public/brand/`, the root ICO/Apple Touch files in each public directory, and `desktop/icons/`. The app's manifest remains in `vite/pwa.ts`; docs intentionally do not receive an installable-app manifest. Web assets never symlink into desktop output.

Preparation fingerprints the artwork, generator code/settings, lockfile and runtime/tool versions, verifies output hashes, and skips unchanged targets. Missing or corrupted outputs regenerate. A cross-process lock serializes concurrent builds; each file is published atomically and the cache is written last. Destination symlinks are rejected. Native ICNS frame ordering is normalized without re-encoding images.

## Review

Use the **Brand/Mark** Storybook stories for main, micro, dark, and monochrome appearances. `tests/e2e/brand/icons.spec.ts` checks the browser assets, app theme selection, and the main mark's visual baseline. Review intentional changes before updating its snapshot. Run at actual 16/24/32 pixel sizes as well as large sizes.

Do not mechanically replace generic pencil/tool icons or historical screenshots. Social artwork, external profile avatars, and Apple Icon Composer layered icons are separate design/export tasks.
