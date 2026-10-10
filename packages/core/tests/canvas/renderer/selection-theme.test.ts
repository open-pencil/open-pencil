import { expect, test } from 'bun:test'

import { SkiaRenderer } from '#core/canvas'
import { DEFAULT_SELECTION_THEME } from '#core/constants'
import { initCanvasKit } from '#core/io'

import { expectDefined } from '#core-tests/helpers/assert'

const ck = await initCanvasKit()

function withRenderer(run: (renderer: SkiaRenderer) => void) {
  const surface = expectDefined(ck.MakeSurface(64, 64), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    run(renderer)
  } finally {
    renderer.destroy()
  }
}

function rgb(color: Float32Array) {
  return Array.from(color.slice(0, 3), (channel) => Math.round(channel * 255))
}

const GREEN_THEME = {
  color: { r: 0.08, g: 0.5, b: 0.24, a: 1 },
  foreground: { r: 0, g: 0, b: 0, a: 1 }
}

test('starts with the default blue and white text on it', () => {
  withRenderer((renderer) => {
    expect(renderer.selectionTheme).toEqual(DEFAULT_SELECTION_THEME)
    expect(rgb(renderer.selForegroundColor())).toEqual([255, 255, 255])
  })
})

test('long-lived selection paints and text follow a new selection theme', () => {
  withRenderer((renderer) => {
    renderer.setSelectionTheme(GREEN_THEME)
    const { r, g, b } = GREEN_THEME.color
    const expected = rgb(ck.Color4f(r, g, b, 1))
    for (const paint of [
      renderer.selectionPaint,
      renderer.parentOutlinePaint,
      renderer.penHandlePaint,
      renderer.penVertexStroke
    ]) {
      expect(rgb(paint.getColor())).toEqual(expected)
    }
    expect(rgb(renderer.selColor())).toEqual(expected)
    expect(rgb(renderer.selForegroundColor())).toEqual([0, 0, 0])
  })
})

test('an unset theme returns to the default', () => {
  withRenderer((renderer) => {
    renderer.setSelectionTheme(GREEN_THEME)
    renderer.setSelectionTheme(undefined)
    expect(renderer.selectionTheme).toEqual(DEFAULT_SELECTION_THEME)
    expect(rgb(renderer.selectionPaint.getColor())).toEqual(rgb(renderer.selColor()))
  })
})
