import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createHeadlessFigma } from '#cli/tool-data'

setDefaultTimeout(60_000)

/** A PNG's size, from its header. */
function pngSize(data: Uint8Array): [number, number] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

describe('headless text bounds', () => {
  test('take a text by its ink, as the app does', async () => {
    const figma = await createHeadlessFigma(new SceneGraph())
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = figma.createText()
    text.fontSize = 40
    text.characters = 'xo'
    const bounds = text.absoluteRenderBounds
    if (!bounds) throw new Error('Expected the text to draw')
    // Lowercase glyphs sit well inside the line box.
    expect(bounds.y).toBeGreaterThan(text.y + 10)
    expect(bounds.height).toBeLessThan(text.height / 2)
    const [width, height] = pngSize(await text.exportAsync({ format: 'PNG' }))
    expect(width).toBe(Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x))
    expect(height).toBeLessThan(text.height / 2)
  })
})
