import { describe, expect, it } from 'bun:test'

import { attachImages } from '#dom-css/runtime/resources'
import type { DesignElement } from '#dom-css/types'

describe('background pictures read for an element', () => {
  it('keeps a redirected picture under the address the style names', async () => {
    const element: DesignElement = {
      type: 'element',
      tagName: 'div',
      attrs: {},
      children: [],
      computedStyle: { 'background-image': 'url("https://site.test/hero.png")' }
    }
    const bytes = new Uint8Array([1, 2, 3])

    await attachImages([], async () => ({ url: 'https://cdn.site.test/hero-1200.png', bytes }), [
      element
    ])

    // The importer finds each layer's picture by the address its `url()` names.
    expect(element.backgroundImages).toEqual([{ url: 'https://site.test/hero.png', bytes }])
  })
})
