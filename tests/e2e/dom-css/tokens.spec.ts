import { browserTokenStylesheet } from '#tests/helpers/dom-css-browser'

import { expect, test } from '../fixtures'

test.describe('@open-pencil/dom-css token stylesheet in a browser', () => {
  test("checks token values and conditions with the browser's CSS parser", async ({ page }) => {
    const { css, issues } = await browserTokenStylesheet(page)

    expect(css).toBe(
      [
        ':root {',
        '  --color-surface: #FFFFFF;',
        '  --spacing-gutter: clamp(1rem, 4vw, 2rem);',
        '}',
        '',
        '/* Theme: Dark */',
        '[data-theme="dark"] {',
        '  --color-surface: #000000;',
        '  --spacing-gutter: 24px;',
        // Gap's default value was left out, so its Dark value differs from an empty base.
        '  --gap: 8px;',
        '}',
        ''
      ].join('\n')
    )
    expect(issues).toEqual([
      'Gap is not a valid CSS declaration: --gap: 1px; } body { display: none',
      'Theme: Evil has a condition that is not a selector or a @media, @supports or @container query: .x } body { display: none'
    ])
  })
})
