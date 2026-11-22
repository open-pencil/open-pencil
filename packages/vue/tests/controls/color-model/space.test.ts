import { describe, expect, test } from 'bun:test'

import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { createEditor } from '@open-pencil/core'
import type { Fill, ColorProfile } from '@open-pencil/scene-graph'
import { colorToProfileCSS, okhclToRGBA, rgbaToOkHCL } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'

import {
  linearGradientCSS,
  provideColorSpace,
  provideEditorColorSpaces,
  reportCanvasPresentation,
  useColorCSS,
  useColorSpaces
} from '#vue/controls/color-model/space'
import { useColorModel } from '#vue/controls/color-model/use'
import { useFill } from '#vue/primitives/Fill/useFill'

/** Runs `child` in a component under one that runs `parent`, as an app mounts them. */
function mountUnder<T>(parent: () => void, child: () => T) {
  let result: T | undefined
  const Child = defineComponent({
    setup() {
      result = child()
      return () => h('div')
    }
  })
  const app = createTestRenderer().createApp(
    defineComponent({
      setup() {
        parent()
        return () => h(Child)
      }
    })
  )
  app.mount(hostNode())
  if (result === undefined) throw new Error('Expected the child to set up')
  return { result, unmount: () => app.unmount() }
}

const P3_RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const solid = (color: Color): Fill => ({ type: 'SOLID', color, opacity: 1, visible: true })

/** What a component under `provideColorSpace(stored, shown)`, or under none, shows `P3_RED` as. */
function shown(stored?: Ref<ColorProfile>, presented?: Ref<ColorProfile>) {
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
    const space = ref<ColorProfile>('display-p3')
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

  test("OkHCL reads and writes a P3 document's components as P3", () => {
    const updates: Color[] = []
    const { result: model, unmount } = mountUnder(
      () => provideColorSpace('display-p3'),
      () => useColorModel({ color: P3_RED, onUpdate: (color) => updates.push(color) })
    )
    const okhcl = rgbaToOkHCL(P3_RED, 'display-p3')
    expect(model.okhcl.value.c).toBeCloseTo(okhcl.c, 5)
    expect(model.okhcl.value.c).toBeGreaterThan(rgbaToOkHCL(P3_RED).c)
    model.updateOkHCLChannel('l', 0.5)
    const expected = okhclToRGBA({ ...model.okhcl.value, l: 0.5 }, 'display-p3')
    expect(updates.at(-1)?.r).toBeCloseTo(expected.r, 5)
    unmount()
  })

  test('slider previews show in the profile the canvas presents', () => {
    const { result: model, unmount } = mountUnder(
      () => provideColorSpace('display-p3', 'srgb'),
      () => useColorModel({ color: P3_RED })
    )
    // Shown clipped to sRGB, so the stops are rgb(), not color(display-p3 …).
    expect(model.sliderGradient.value.hsbSaturation).not.toContain('color(display-p3')
    unmount()
  })

  test("provideEditor's spaces follow the document's profile and the canvas's presentation", async () => {
    const editor = createEditor()
    const { result, unmount } = mountUnder(
      () => provideEditorColorSpaces(editor),
      () => ({ spaces: useColorSpaces(), report: reportCanvasPresentation() })
    )
    try {
      expect(result.spaces.value).toEqual({ stored: 'srgb', shown: 'srgb' })
      editor.setDocumentColorSpace('display-p3')
      await nextTick()
      expect(result.spaces.value).toEqual({ stored: 'display-p3', shown: 'display-p3' })
      result.report('srgb')
      await nextTick()
      expect(result.spaces.value).toEqual({ stored: 'display-p3', shown: 'srgb' })
    } finally {
      unmount()
      editor.dispose()
    }
  })
})

describe('canvas presentation reports', () => {
  test("a canvas that goes leaves the remaining canvas's report", async () => {
    const editor = createEditor()
    const { result, unmount } = mountUnder(
      () => provideEditorColorSpaces(editor),
      () => ({
        spaces: useColorSpaces(),
        first: reportCanvasPresentation(),
        second: reportCanvasPresentation()
      })
    )
    try {
      editor.setDocumentColorSpace('display-p3')
      result.first('srgb')
      result.second('display-p3')
      await nextTick()
      expect(result.spaces.value.shown).toBe('display-p3')
      result.second(null)
      await nextTick()
      expect(result.spaces.value.shown).toBe('srgb')
      result.first(null)
      await nextTick()
      expect(result.spaces.value.shown).toBe('display-p3')
    } finally {
      unmount()
      editor.dispose()
    }
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
      `${colorToProfileCSS({ r: 1, g: 0.5, b: 0.5, a: 1 }, 'display-p3', 'srgb')} 50%`
    )
    expect(css).toStartWith('linear-gradient(to right in display-p3, ')
  })

  test('an unpositioned stop sits where CSS puts it, between its neighbours', () => {
    const spaces = { stored: 'display-p3', shown: 'srgb' } as const
    const white = { r: 1, g: 1, b: 1, a: 1 }
    const black = { r: 0, g: 0, b: 0, a: 1 }
    const css = linearGradientCSS(
      'to right',
      [{ color: white, position: 0.2 }, { color: P3_RED }, { color: black, position: 0.6 }],
      spaces
    )
    const red = colorToProfileCSS(P3_RED, 'display-p3', 'srgb')
    expect(css).toContain(`${red} 40%`)
  })

  test('sRGB colors shown in P3 still blend in sRGB', () => {
    const css = linearGradientCSS(
      'to right',
      [{ color: { r: 0, g: 0, b: 0, a: 1 } }, { color: { r: 1, g: 1, b: 1, a: 1 } }],
      { stored: 'srgb', shown: 'display-p3' }
    )
    expect(css).toStartWith('linear-gradient(to right in srgb, ')
  })
})
