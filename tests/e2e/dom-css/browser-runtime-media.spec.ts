import {
  computedStyleProperties,
  publicBrowserImageNode,
  setStyledContent
} from '#tests/helpers/dom-css-browser'

import { expect, test } from '../fixtures'

const TRANSPARENT_PIXEL_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test.describe('@open-pencil/dom-css browser CSS media and image oracle', () => {
  test('resolves media queries and inherited em/rem units in a real browser', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 600 })
    await setStyledContent(
      page,
      `
        :root { font-size: 10px; }
        .panel {
          font-size: 20px;
          width: 20rem;
          padding: 2em;
        }
        @media (min-width: 800px) {
          .panel { width: 30rem; }
        }
      `,
      '<section class="panel">OpenPencil</section>'
    )

    const widePanel = await computedStyleProperties(page, '.panel', [
      'font-size',
      'padding-left',
      'width'
    ])
    expect(widePanel['font-size']).toBe('20px')
    expect(widePanel['padding-left']).toBe('40px')
    expect(widePanel.width).toBe('300px')

    await page.setViewportSize({ width: 640, height: 600 })
    const narrowPanel = await computedStyleProperties(page, '.panel', ['width'])
    expect(narrowPanel.width).toBe('200px')
  })

  test('projects browser image sizing and object fit into scene graph fields', async ({ page }) => {
    const imageNode = await publicBrowserImageNode(
      page,
      `<img class="media" alt="Preview" src="${TRANSPARENT_PIXEL_DATA_URL}" />`,
      '.media { aspect-ratio: 16 / 9; object-fit: contain; width: 320px; }'
    )

    expect(imageNode?.type).toBe('FRAME')
    expect(imageNode?.width).toBe(320)
    expect(imageNode?.height).toBe(180)
    expect(imageNode?.fillType).toBe('IMAGE')
    expect(imageNode?.imageScaleMode).toBe('FIT')
    expect(imageNode?.hasImageBytes).toBe(true)
  })
})
