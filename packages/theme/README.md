# @open-pencil/theme

OpenPencil's look as Tailwind CSS 4, for pages built apart from the editor that should look like it, such as Cloud's billing pages. It has no framework and no runtime dependencies: the component styles are [tailwind-variants](https://www.tailwind-variants.org) configs, plain objects you pass to `tv()` in Vue, React, or plain HTML.

| Import | What it has |
| --- | --- |
| `@open-pencil/theme/tokens.css` | The design tokens, light and dark, with OpenPencil's custom variants and utilities. Import it into your own Tailwind stylesheet; it also registers the configs' classes, so Tailwind generates them. |
| `@open-pencil/theme` | tailwind-variants configs: `buttonTheme`, `inputTheme`, `alertTheme`, `linkTheme`, `focusStyles`, `panelFieldBase` and `panelFieldState`, `settingsTheme`, and `portalLayoutTheme` and `portalPublicTheme` for Cloud's pages. |

```css
@import 'tailwindcss';
@import '@open-pencil/theme/tokens.css';
```

```ts
import { buttonTheme } from '@open-pencil/theme'
import { tv } from 'tailwind-variants'

const button = tv(buttonTheme)
button({ color: 'primary', size: 'lg' })
```
