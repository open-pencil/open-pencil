import { describe, expect, test } from 'bun:test'

import {
  colorDistance,
  exportFigFile,
  FigmaAPI,
  getFillOkHCL,
  getStrokeOkHCL,
  initCodec,
  okhclToRGBA,
  parseFigFile,
  rgbaToOkHCL,
  SceneGraph
} from '@open-pencil/core'

describe('OkHCL metadata', () => {
  test('applies rgba rendering color while preserving fill metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.fills = [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0, g: 0, b: 0, a: 1 } }]

    frame.setFillOkHCL({ h: 240, c: 0.12, l: 0.7, a: 0.8 })

    expect(frame.fills[0]?.color).toEqual(okhclToRGBA({ h: 240, c: 0.12, l: 0.7, a: 0.8 }))
    expect(frame.getFillOkHCL()).toMatchObject({
      version: 1,
      kind: 'fill',
      index: 0,
      color: { h: 240, c: 0.12, l: 0.7, a: 0.8 }
    })
  })

  test('applies rgba rendering color while preserving stroke metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.strokes = [
      { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 1, opacity: 1, visible: true, align: 'INSIDE' }
    ]

    frame.setStrokeOkHCL({ h: 20, c: 0.08, l: 0.6 })

    expect(frame.strokes[0]?.color).toEqual(okhclToRGBA({ h: 20, c: 0.08, l: 0.6 }))
    expect(frame.getStrokeOkHCL()).toMatchObject({
      version: 1,
      kind: 'stroke',
      index: 0,
      color: { h: 20, c: 0.08, l: 0.6, a: 1 }
    })
  })

  test('preserves visible color closely when converting rgba to okhcl', () => {
    const rgba = { r: 0.31, g: 0.52, b: 0.83, a: 0.72 }
    const okhcl = rgbaToOkHCL(rgba)
    const roundtrip = okhclToRGBA(okhcl)

    expect(colorDistance(rgba, roundtrip)).toBeLessThan(1)
    expect(Math.abs((roundtrip.a ?? 1) - rgba.a)).toBeLessThan(0.001)
  })

  test('roundtrips okhcl metadata through fig export/import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.name = 'OKHCL frame'
    frame.fills = [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0, g: 0, b: 0, a: 1 } }]
    frame.strokes = [
      { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 1, opacity: 1, visible: true, align: 'INSIDE' }
    ]
    frame.setFillOkHCL({ h: 210, c: 0.1, l: 0.65 })
    frame.setStrokeOkHCL({ h: 320, c: 0.09, l: 0.55, a: 0.9 })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'OKHCL frame')

    expect(parsedFrame).toBeDefined()
    expect(getFillOkHCL(parsedFrame!, 0)).toMatchObject({
      kind: 'fill',
      color: { h: 210, c: 0.1, l: 0.65, a: 1 }
    })
    expect(getStrokeOkHCL(parsedFrame!, 0)).toMatchObject({
      kind: 'stroke',
      color: { h: 320, c: 0.09, l: 0.55, a: 0.9 }
    })
  })
})
