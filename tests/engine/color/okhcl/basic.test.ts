import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import {
  colorDistance,
  getFillOkHCL,
  getStrokeOkHCL,
  okhclToRGBA,
  rgbaToOkHCL
} from '@open-pencil/scene-graph/color'

import { expectDefined } from '#tests/helpers/assert'
import { uint8ArrayToArrayBuffer } from '#tests/helpers/fig/fixtures'
import { solidFill } from '#tests/helpers/plugin-api'

describe('OkHCL metadata', () => {
  test('applies rgba rendering color while preserving fill metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const openpencil = new OpenPencilAPI(api)
    const frame = api.createFrame()
    frame.fills = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]

    openpencil.setFillOkHCL(frame, { h: 240, c: 0.12, l: 0.7, a: 0.8 })

    // The plugin API reads the alpha as the paint's opacity, as Figma does.
    const { a: alpha, ...fillColor } = okhclToRGBA({ h: 240, c: 0.12, l: 0.7, a: 0.8 })
    expect(frame.fills[0]).toMatchObject({ color: fillColor, opacity: alpha })
    expect(openpencil.getFillOkHCL(frame)).toMatchObject({
      version: 1,
      kind: 'fill',
      index: 0,
      color: { h: 240, c: 0.12, l: 0.7, a: 0.8 }
    })
  })

  test('applies rgba rendering color while preserving stroke metadata', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const openpencil = new OpenPencilAPI(api)
    const frame = api.createFrame()
    frame.strokes = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokeWeight = 1
    frame.strokeAlign = 'INSIDE'

    openpencil.setStrokeOkHCL(frame, { h: 20, c: 0.08, l: 0.6 })

    const { a: alpha, ...strokeColor } = okhclToRGBA({ h: 20, c: 0.08, l: 0.6 })
    expect(frame.strokes[0]).toMatchObject({ color: strokeColor, opacity: alpha })
    expect(openpencil.getStrokeOkHCL(frame)).toMatchObject({
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
    const openpencil = new OpenPencilAPI(api)
    const frame = api.createFrame()
    frame.name = 'OKHCL frame'
    frame.fills = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokes = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokeWeight = 1
    frame.strokeAlign = 'INSIDE'
    openpencil.setFillOkHCL(frame, { h: 210, c: 0.1, l: 0.65 })
    openpencil.setStrokeOkHCL(frame, { h: 320, c: 0.09, l: 0.55, a: 0.9 })

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
