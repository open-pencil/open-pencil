# OpenPencil brand sources

Logo kit v5 (published at https://github.com/rcoenen/openpencil-logo-kit): a P built from three primitives on a 2 × 3 grid of equal square cells, in flat colour.

- `mark.svg` is the colour mark: a square stem, a half-disc bowl, and a rounded-square foot, the pencil. Rounded corners are half a cell. The counter is a circle of 0.4 cell with one sharp corner, centred on the seam so it locks stem and bowl together; its sharp corner points down-left, toward the foot.
- `mark-micro.svg` is the same artwork at 16px, for favicons. The kit has no separate small drawing: below 24px it prefers the one-colour mark, which the generator derives.
- Both draw the 200 × 300 mark centred on a square `0 0 300 300` canvas, so the generator can place them like any square artwork. Keep the two files' geometry identical.
- Each piece carries a `data-part` (`stem`, `bowl`, `foot`). The hidden `data-shape="silhouette"` path is the whole P as one shape: the one-colour variants draw it in place of the pieces, whose shared edges would otherwise show seams.

| Piece | `data-part` | Name  | Hex       |
| ----- | ----------- | ----- | --------- |
| Stem  | `stem`      | Flame | `#F5501E` |
| Bowl  | `bowl`      | Sun   | `#FFD43B` |
| Foot  | `foot`      | Dusk  | `#9B5CFF` |
| One colour | —      | Ink   | `#111111` |

A sunset read top to bottom: flame stem, sun bowl, dusk foot. Flat colour only: no gradients, shadows, or outlines on the colour mark.

## Backgrounds and tiles

The colour mark sits bare on white, black, and neutral greys, including the dark UI grey `#2A2A2A`, so the dark variants keep its colours. On colour or busy backgrounds, use a tile or the one-colour mark, and never place the bare colour mark on flame, sun, or dusk. The one-colour mark is ink on light backgrounds and white on dark ones.

The app icon is the colour mark on the ink (`#111111`) rounded tile, holding the mark at 76% of the tile's height; it reads on light and dark tabs alike. The same tile is the favicon in both browser themes, the any-purpose PWA icon, the profile image, and the editor header's 24px mark. Native desktop icons keep their platform-specific outer margin with the mark at the same share of the tile. Apple Touch keeps an opaque square for platform rounding; maskable artwork stays opaque and inside the central 80%-diameter safe circle.

`icons/mark-modular.svg` is the kit's modular outline: the P and the lines between its three pieces, drawn with `currentColor` on a 24px grid with a 1.5px line, so it takes the text color wherever it is shown. Vite serves `icons/` as the `brand` icon collection (`<icon-brand-mark-modular />`). `icons/lockup.svg` is the horizontal lockup with its wordmark in `currentColor`.

The loading screen in `index.html` inlines the assembling mark: each piece's outline draws in, the pieces slide together, and their colour wipes in, about 1.6s in all. `src/app/shell/boot-splash.ts` keeps it up until that animation has finished and the app has mounted, whichever is later; reduced motion, `?test`, and automated browsers skip the wait.

Minimum sizes: the colour mark 24px tall; the one-colour mark 16px. Keep half a cell, a quarter of the mark's width, clear on every side.

Edit these SVGs, not generated files. The tile colour, the one-colour ink and paper, and platform padding live in `tools/generate/brand/src/config.ts`.

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

Use the **Brand/Mark** Storybook stories for the colour, micro, and one-colour appearances. `tests/e2e/brand/icons.spec.ts` checks the browser assets, app theme selection, and the main mark's visual baseline. Review intentional changes before updating its snapshot. Run at actual 16/24/32 pixel sizes as well as large sizes.

Do not mechanically replace generic pencil/tool icons or historical screenshots. Social artwork, external profile avatars, and Apple Icon Composer layered icons are separate design/export tasks.
