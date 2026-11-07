import { describe, expect, test } from 'bun:test'

import { extractImageAssets } from '#dom-css/export/bundle'

import { imageDataURL, svgDataURL } from '@open-pencil/scene-graph/images'

const PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89
])

describe('extractImageAssets', () => {
  test('moves a raster image to a file named for its type, once', () => {
    const src = imageDataURL(PIXEL)
    const { html, files } = extractImageAssets(
      `<img src="${src}"><img src="${src}">`,
      'page.assets'
    )
    expect(files).toEqual([{ path: 'page.assets/images/image-1.png', content: PIXEL }])
    expect(html).toBe(
      '<img src="page.assets/images/image-1.png"><img src="page.assets/images/image-1.png">'
    )
  })

  test('keeps SVG, types without an extension, and data URLs it cannot decode inline', () => {
    const svg = svgDataURL(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    )
    const base64SVG =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='
    const avif = imageDataURL(PIXEL).replace('image/png', 'image/avif')
    const escaped = `data:image/png,${Array.from(PIXEL, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('')}`
    const html = `<img src="${svg}"><img src="${base64SVG}"><img src="${avif}"><img src="${escaped}"><img src="data:image/png;base64,iVBORw0KG">`
    expect(extractImageAssets(html, 'page.assets').files).toEqual([])
  })
})
