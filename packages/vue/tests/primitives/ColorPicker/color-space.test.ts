import { describe, expect, test } from 'bun:test'

import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'
import {
  colorToDisplayCSS,
  okhclToRGBA,
  rgbaToOkHCL,
  type RenderColorSpace
} from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'

import { useColorModel } from '#vue/controls/color-model/use'
import {
  linearGradientCSS,
  provideColorSpace,
  sliderTrackBackground,
  useColorCSS
} from '#vue/primitives/ColorPicker/color-space'
import { useFill } from '#vue/primitives/Fill/useFill'

const P3_RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const solid = (color: Color): Fill => ({ type: 'SOLID', color, opacity: 1, visible: true })

/** What a component under `provideColorSpace(stored, shown)`, or under none, shows `P3_RED` as. */
function shown(stored?: Ref<RenderColorSpace>, presented?: Ref<RenderColorSpace>) {
  let colorCSS: ((color: Color) => string) | undefined
  let swatch: Ref<string> | undefined
  const Child = defineComponent({
    setup() {
      colorCSS = useColorCSS()
      swatch = useFill(ref(solid(P3_RED)), () => undefined).swatchBackground
      return () => h('div')
    }
  })
  const app = createTestRenderer().createApp(
    defineComponent({
      setup() {
        if (stored) provideColorSpace(stored, presented ?? stored)
        return () => h(Child)
      }
    })
  )
  app.mount(hostNode())
  if (!colorCSS || !swatch) throw new Error('Expected the child to set up')
  const css = colorCSS
  const background = swatch
  return { color: () => css(P3_RED), swatch: () => background.value, unmount: () => app.unmount() }
}

describe('color space of shown colors', () => {
  test('a subtree with no profile shows colors as sRGB', () => {
    const { color, swatch, unmount } = shown()
    expect(color()).toBe('rgb(255, 0, 0)')
    expect(swatch()).toBe('rgb(255, 0, 0)')
    unmount()
  })

  test("a Display P3 document's swatches show its colors as P3, following a profile change", async () => {
    const space = ref<RenderColorSpace>('display-p3')
    const { color, swatch, unmount } = shown(space)
    expect(color()).toBe('color(display-p3 1 0 0)')
    expect(swatch()).toBe('color(display-p3 1 0 0)')
    space.value = 'srgb'
    await nextTick()
    expect(swatch()).toBe('rgb(255, 0, 0)')
    unmount()
  })

  test('on a canvas that falls back to sRGB, swatches clip as the canvas does', () => {
    const { color, swatch, unmount } = shown(ref('display-p3'), ref('srgb'))
    // P3 red lies outside sRGB; the canvas clamps it to sRGB red, and so does the swatch.
    expect(color()).toBe('rgb(255, 0, 0)')
    expect(swatch()).toBe('rgb(255, 0, 0)')
    unmount()
  })

  test('slider tracks are left to Reka in sRGB and drawn in P3 components otherwise', () => {
    const red = { space: 'rgb', r: 255, g: 0, b: 0, alpha: 1 } as const
    const srgb = { stored: 'srgb', shown: 'srgb' } as const
    const p3 = { stored: 'display-p3', shown: 'display-p3' } as const
    expect(sliderTrackBackground(red, 'hue', 'hsb', srgb)).toBeUndefined()
    expect(sliderTrackBackground(red, 'hue', 'hsb', p3)).toBe(
      'linear-gradient(to right in display-p3, color(display-p3 1 0 0), color(display-p3 1 1 0), ' +
        'color(display-p3 0 1 0), color(display-p3 0 1 1), color(display-p3 0 0 1), ' +
        'color(display-p3 1 0 1), color(display-p3 1 0 0))'
    )
    expect(sliderTrackBackground(red, 'alpha', 'hsb', p3)).toStartWith(
      'linear-gradient(to right in display-p3, color(display-p3 1 0 0 / 0), color(display-p3 1 0 0)), '
    )
  })

  test("OkHCL reads and writes a P3 document's components as P3", () => {
    const updates: Color[] = []
    const model = useColorModel({
      color: P3_RED,
      colorSpace: 'display-p3',
      onUpdate: (color) => updates.push(color)
    })
    const okhcl = rgbaToOkHCL(P3_RED, 'display-p3')
    expect(model.okhcl.value.c).toBeCloseTo(okhcl.c, 5)
    expect(model.okhcl.value.c).toBeGreaterThan(rgbaToOkHCL(P3_RED).c)
    model.updateOkHCLChannel('l', 0.5)
    const expected = okhclToRGBA({ ...model.okhcl.value, l: 0.5 }, 'display-p3')
    expect(updates.at(-1)?.r).toBeCloseTo(expected.r, 5)
  })
})

describe('gradients shown in another profile than stored', () => {
  test('blend in the stored components before clipping, so midpoints match the canvas', () => {
    const white = { r: 1, g: 1, b: 1, a: 1 }
    const css = linearGradientCSS('to right', [{ color: white }, { color: P3_RED }], {
      stored: 'display-p3',
      shown: 'srgb'
    })
    // The document's midpoint P3 (1, 0.5, 0.5), shown in sRGB, is a stop of its own.
    expect(css).toContain(
      `${colorToDisplayCSS({ r: 1, g: 0.5, b: 0.5, a: 1 }, { documentColorSpace: 'display-p3', colorSpace: 'srgb' })} 50%`
    )
    expect(css).toStartWith('linear-gradient(to right in display-p3, ')
  })

  test('sRGB colors shown in P3 still blend in sRGB', () => {
    const css = linearGradientCSS(
      'to right',
      [{ color: { r: 0, g: 0, b: 0, a: 1 } }, { color: { r: 1, g: 1, b: 1, a: 1 } }],
      { stored: 'srgb', shown: 'display-p3' }
    )
    expect(css).toStartWith('linear-gradient(to right in srgb, ')
  })

  test('useColorModel keeps the provided presentation for colors stored in its profile', () => {
    let saturationTrack: string | undefined
    const Child = defineComponent({
      setup() {
        const model = useColorModel({ color: P3_RED, colorSpace: 'display-p3' })
        saturationTrack = model.sliderGradient.value.hsbSaturation
        return () => h('div')
      }
    })
    const app = createTestRenderer().createApp(
      defineComponent({
        setup() {
          provideColorSpace('display-p3', 'srgb')
          return () => h(Child)
        }
      })
    )
    app.mount(hostNode())
    // Shown clipped to sRGB, so the stops are rgb(), not color(display-p3 …).
    expect(saturationTrack).not.toContain('color(display-p3')
    app.unmount()
  })
})
