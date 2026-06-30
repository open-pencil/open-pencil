# DOM/CSS parser audit

OpenPencil's DOM/CSS compatibility layer should not grow hand-rolled CSS parsing. Browser conversion should use native DOM/CSSOM and `getComputedStyle()`. Headless conversion may keep narrow approximations only as temporary test/CLI support and should prefer dependency-backed parsers or browser-oracle paths for new CSS behavior.

## Current dependency-backed pieces

- HTML parsing: `parse5` in the headless runtime, native `DOMParser` in the browser runtime.
- Stylesheet parsing and headless inline style declaration parsing: `@acemir/cssom` in the headless runtime, native CSSOM in the browser runtime.
- CSS value tokenization for shadow values: `postcss-value-parser`.
- Tailwind generation: Tailwind v4 `compile()` / `build()`.
- Color parsing: `@open-pencil/core/color` (`culori`-backed).

## Current hand-rolled approximations

These are intentionally limited and should not be expanded without replacing them or proving a dependency cannot cover the use case.

| Area | File | Current behavior | Preferred direction |
|---|---|---|---|
| Selector matching/specificity | `packages/dom-css/src/headless-css.ts` | Supports simple tag/id/class selectors plus descendant and child combinators. Rejects pseudo/classes and attributes. | Replace with a selector engine over DesignDOM or run browser/runtime oracle for complex CSS. |
| Shorthand expansion | `packages/dom-css/src/headless-css.ts` | Expands simple margin/padding boxes, border color/width, and background color. | Use parsed declarations from CSSOM/native computed style; avoid adding new shorthand parsers. |
| `calc()` / custom properties | `packages/dom-css/src/headless-css.ts` | Resolves variables by direct lookup and only handles `calc(<number><unit> * <number>)`. | Browser runtime for real computed values; do not add arithmetic or fallback parsing manually. |
| JSX object style serialization | `packages/dom-css/src/jsx/runtime.ts` | Serializes object style props to inline CSS strings with simple camelCase to kebab-case conversion. | Keep as JSX authoring serialization only; use CSSOM/native parsing after HTML parsing. |
| Shadow values | `packages/dom-css/src/css-values.ts` | Uses `postcss-value-parser` tokenization for one simple outer shadow layer. Multiple shadows and inset shadows remain unsupported. | Keep using value-parser/browser-computed values; do not add string splitting for complex shadow grammar. |
| Numeric lengths | `packages/dom-css/src/css-values.ts` | Parses px/rem-ish numbers with `Number.parseFloat`. | Consume browser-computed pixel values where available; keep headless numeric parsing narrow. |

## Rule for new mapping work

- Do not add regex/string parsers for CSS grammar such as gradients, transforms, filters, complex shadows, selectors, variable fallback, or calc arithmetic.
- Prefer browser `getComputedStyle()` fixtures as oracle coverage.
- If headless support is required, first look for a maintained parser/runtime dependency and document why it was chosen.
- If a temporary approximation is unavoidable, keep it narrow, add tests that define its limits, and list it in this audit.

## Recently rejected

Linear-gradient parsing was started with manual comma/direction parsing and removed. Gradient support should be implemented only through a proper CSS value parser or browser-native extracted data that can be mapped without parsing CSS grammar manually.
