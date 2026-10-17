import { describe, expect, test } from 'bun:test'

import { filterCanvasFiles } from '#vue/canvas/drop/use'

describe('canvas file drops', () => {
  test('keeps supported raster and SVG files in source order', () => {
    const svg = new File(['<svg/>'], 'mark.svg', { type: 'image/svg+xml' })
    const image = new File(['png'], 'photo.png', { type: 'image/png' })
    const text = new File(['text'], 'notes.txt', { type: 'text/plain' })

    expect(filterCanvasFiles([svg, text, image])).toEqual([svg, image])
  })

  test('recognizes SVG filenames without MIME metadata', () => {
    const svg = new File(['<svg/>'], 'mark.SVG')
    expect(filterCanvasFiles([svg])).toEqual([svg])
  })

  test('leaves a draw.io export to open as the diagram it embeds', () => {
    const exported = new File(['png'], 'flow.drawio.png', { type: 'image/png' })
    const image = new File(['png'], 'flow.png', { type: 'image/png' })
    expect(filterCanvasFiles([exported, image])).toEqual([image])
  })
})
