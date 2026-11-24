import { describe, expect, test } from 'bun:test'

import { getPageColor } from '#core/figma-api/page-backgrounds'
import { readHTMLDocument } from '#core/io/formats/html/import'

describe('the page behind imported HTML', () => {
  test('takes the background CSS paints the canvas with, the body’s when the root has none', async () => {
    const { graph } = await readHTMLDocument(
      '<style>body { margin: 0; background: #102030 }</style><p>Dark page</p>'
    )

    expect(getPageColor(graph.getPages()[0])).toMatchObject({
      r: 0x10 / 255,
      g: 0x20 / 255,
      b: 0x30 / 255
    })
  })

  test('is white when the page sets none, as a browser shows it', async () => {
    const { graph } = await readHTMLDocument('<p>Plain page</p>')

    expect(getPageColor(graph.getPages()[0])).toMatchObject({ r: 1, g: 1, b: 1, a: 1 })
  })
})
