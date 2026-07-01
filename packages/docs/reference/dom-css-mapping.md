# DOM/CSS mapping reference

OpenPencil maps browser-computed DOM/CSS styles into SceneGraph fields through `@open-pencil/dom-css`. Browser adapters should use native DOM/CSSOM and `getComputedStyle()` as the source of truth. Headless conversion is an approximation for tests and CLI usage.

## Layout

| CSS | SceneGraph | Notes |
|---|---|---|
| `display: flex` / `inline-flex` | `layoutMode` | `flex-direction: row` maps to horizontal; `column` maps to vertical. |
| `justify-content` | `primaryAxisAlign` | Supports start, center, end/flex-end, and space-between. |
| `align-items` | `counterAxisAlign` | Supports start, center, end/flex-end, stretch, and baseline. |
| `align-self` | `layoutAlignSelf` | Supports start, center, end/flex-end, stretch, and baseline. |
| `flex-wrap: wrap` | `layoutWrap: WRAP` | Counter-axis spacing is preserved when gaps are available. |
| `gap`, `row-gap`, `column-gap` | `itemSpacing`, `counterAxisSpacing` | Axis-aware: row and column gaps swap meaning for column flex direction. |
| `padding-*` | `paddingTop/Right/Bottom/Left` | Browser-computed physical values are preferred. |
| `position: absolute/fixed`, `left`, `top` | `layoutPositioning`, `x`, `y` | Right/bottom constraints are not mapped yet. |
| `overflow: hidden/clip` | `clipsContent` | Other overflow values are ignored. |
| `width`, `height`, min/max sizes | node size constraints | Browser-computed pixel values are preferred. |
| `aspect-ratio` | fallback width/height sizing | Used when one axis is available and the other is `auto`/missing. |

## Paint, stroke, and effects

| CSS | SceneGraph | Notes |
|---|---|---|
| `background-color` | solid fill | Transparent values are ignored. |
| `border-color`, `border-*-color` | stroke color | First available border color is used. |
| `border-width`, `border-*-width` | stroke weight / independent stroke weights | Side-specific widths set independent stroke weights. |
| `border-style: dashed/dotted` | `dashPattern` | Unsupported border styles fall back to solid. |
| `border-radius`, `border-*-radius` | corner radii | Independent corners are preserved when sides differ. |
| `opacity` | node opacity | Numeric computed value. |
| `box-shadow` | drop shadow | First simple outer shadow only; complex shadow lists require maintained parser or browser-computed support before mapping. |
| `<img src="data:...">` | image fill | Data URL images are stored in the graph image map. |
| `<img src="https://...">` | preserved source URL metadata | External URL fetching is not performed; the URL is retained for HTML round-trip. |
| `object-fit: contain/cover` | image `FIT` / `FILL` scale mode | `scale-down` maps to `FIT`; other object-fit values are not mapped yet. |

## Text

| CSS | SceneGraph | Notes |
|---|---|---|
| `color` | text fill | Uses core color parsing. |
| `font-family` | `fontFamily` | Uses first family token. |
| `font-size` | `fontSize` | Pixel/rem-ish numeric values. |
| `font-weight` | `fontWeight` | Numeric values. |
| `font-style: italic` | `italic` | Other styles ignored. |
| `line-height` | `lineHeight` | Numeric computed values. |
| `letter-spacing` | `letterSpacing` | Numeric computed values. |
| `text-align` | horizontal text alignment | Supports center, right, justified; defaults left. |
| `text-decoration-line` | underline / strikethrough | Decoration style/thickness are not mapped yet. |
| `text-transform` | `textCase` | Uppercase, lowercase, and capitalize map to SceneGraph text case. |
| `white-space: nowrap` | `maxLines = 1` | Other white-space values are not mapped yet. |
| `text-shadow` | drop shadow effect | Simple shadows only. |

## Browser-oracle but not mapped yet

These values are collected or covered by browser oracle tests but do not yet have a stable SceneGraph mapping:

- complex gradients
- CSS filters
- multi-shadow lists
- media-query-specific provenance
- pseudo-elements

## Headless limitations

The headless runtime uses maintained parsers for HTML (`parse5`) and stylesheets/inline declarations (`@acemir/cssom`), but still has limited approximations for selector matching, shorthand expansion, `calc()`, and simple shadows. Do not expand those with ad hoc parsers; prefer browser `getComputedStyle()` oracle coverage or maintained parser dependencies for new CSS behavior.
