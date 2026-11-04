import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '#core/canvas'
import { DEFAULT_SELECTION_THEME } from '#core/constants'
import { initCanvasKit } from '#core/io/formats/raster/headless'

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

test('chrome colours are allocated once per theme and again after it changes', () => {
  withRenderer((renderer) => {
    const blue = renderer.selColor()
    expect(renderer.selColor()).toBe(blue)
    expect(renderer.selColor(0.5)).not.toBe(blue)
    expect(renderer.selColor(0.5)).toBe(renderer.selColor(0.5))
    renderer.setSelectionTheme(GREEN_THEME)
    const green = renderer.selColor()
    expect(green).not.toBe(blue)
    expect(rgb(green)).toEqual(rgb(ck.Color4f(0.08, 0.5, 0.24, 1)))
  })
})
