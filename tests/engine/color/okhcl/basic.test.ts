import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { exportFigFile, parseFigFile } from '@lawha/core/io/formats/fig'
import { LawhaAPI } from '@lawha/core/lawha-api'
import { initCodec } from '@lawha/kiwi/fig/codec'
import { SceneGraph } from '@lawha/scene-graph'
import {
  colorDistance,
  getFillOkHCL,
  getStrokeOkHCL,
  okhclToRGBA,
  rgbaToOkHCL
} from '@lawha/scene-graph/color'

import { expectDefined } from '#tests/helpers/assert'
import { uint8ArrayToArrayBuffer } from '#tests/helpers/fig/fixtures'
import { solidFill } from '#tests/helpers/plugin-api'

describe('OkHCL metadata', () => {
  test('applies rgba rendering color while preserving fill metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const lawha = new LawhaAPI(api)
    const frame = api.createFrame()
    frame.fills = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]

    lawha.setFillOkHCL(frame, { h: 240, c: 0.12, l: 0.7, a: 0.8 })

    // The plugin API reads the alpha as the paint's opacity, as Figma does.
    const { a: alpha, ...fillColor } = okhclToRGBA({ h: 240, c: 0.12, l: 0.7, a: 0.8 })
    expect(frame.fills[0]).toMatchObject({ color: fillColor, opacity: alpha })
    expect(lawha.getFillOkHCL(frame)).toMatchObject({
      version: 1,
      kind: 'fill',
      index: 0,
      color: { h: 240, c: 0.12, l: 0.7, a: 0.8 }
    })
  })

  test('applies rgba rendering color while preserving stroke metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const lawha = new LawhaAPI(api)
    const frame = api.createFrame()
    frame.strokes = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokeWeight = 1
    frame.strokeAlign = 'INSIDE'

    lawha.setStrokeOkHCL(frame, { h: 20, c: 0.08, l: 0.6 })

    const { a: alpha, ...strokeColor } = okhclToRGBA({ h: 20, c: 0.08, l: 0.6 })
    expect(frame.strokes[0]).toMatchObject({ color: strokeColor, opacity: alpha })
    expect(lawha.getStrokeOkHCL(frame)).toMatchObject({
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
    const lawha = new LawhaAPI(api)
    const frame = api.createFrame()
    frame.name = 'OKHCL frame'
    frame.fills = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokes = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokeWeight = 1
    frame.strokeAlign = 'INSIDE'
    lawha.setFillOkHCL(frame, { h: 210, c: 0.1, l: 0.65 })
    lawha.setStrokeOkHCL(frame, { h: 320, c: 0.09, l: 0.55, a: 0.9 })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(uint8ArrayToArrayBuffer(bytes))
    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'OKHCL frame')

    const parsedOkhclFrame = expectDefined(parsedFrame, 'parsed OKHCL frame')
    expect(getFillOkHCL(parsedOkhclFrame, 0)).toMatchObject({
      kind: 'fill',
      color: { h: 210, c: 0.1, l: 0.65, a: 1 }
    })
    expect(getStrokeOkHCL(parsedOkhclFrame, 0)).toMatchObject({
      kind: 'stroke',
      color: { h: 320, c: 0.09, l: 0.55, a: 0.9 }
    })
  })
})
