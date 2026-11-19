import { convertToHsb, convertToHsl, convertToRgb, getChannelRange, setChannelValue } from 'reka-ui'
import type { Color as RekaColor, ColorChannel, ColorSpace as RekaColorSpace } from 'reka-ui'
import { computed, hasInjectionContext, inject, provide, toValue } from 'vue'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue'

import { colorToDisplayCSS, type RenderColorSpace } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

const COLOR_SPACE_KEY: InjectionKey<() => RenderColorSpace> = Symbol('open-pencil-color-space')

/**
 * Declares the profile the colors in this subtree are stored in, so swatches, picker tracks, and
 * gradient stops show them as the canvas draws them: a Display P3 document's components as P3
 * colors. Unprovided, colors are sRGB, as a preference's are.
 */
export function provideColorSpace(space: MaybeRefOrGetter<RenderColorSpace>): void {
  provide(COLOR_SPACE_KEY, () => toValue(space))
}

/**
 * The profile {@link provideColorSpace} declared for this subtree, sRGB when none did or when
 * called outside a component.
 */
export function useColorSpace(): ComputedRef<RenderColorSpace> {
  const srgb = (): RenderColorSpace => 'srgb'
  const space = hasInjectionContext() ? inject(COLOR_SPACE_KEY, srgb) : srgb
  return computed(() => space())
}

/** `color`, whose components are in `space`, as CSS that shows that color. */
export function colorCSS(color: Color, space: RenderColorSpace): string {
  return colorToDisplayCSS(color, { documentColorSpace: space })
}

/** {@link colorCSS} in the profile of this subtree. */
export function useColorCSS(): (color: Color) => string {
  const space = useColorSpace()
  return (color) => colorCSS(color, space.value)
}

function sceneColor(color: RekaColor): Color {
  const { r, g, b, alpha } = convertToRgb(color)
  return { r: r / 255, g: g / 255, b: b / 255, a: alpha }
}

/**
 * A CSS linear gradient through `stops`, each at its `position` from 0 to 1 or spread evenly,
 * blended in the components the colors are stored in, as the canvas blends a gradient fill.
 */
export function linearGradientCSS(
  direction: string,
  stops: ReadonlyArray<{ color: Color; position?: number }>,
  space: RenderColorSpace
): string {
  const css = stops.map(({ color, position }) =>
    position === undefined ? colorCSS(color, space) : `${colorCSS(color, space)} ${position * 100}%`
  )
  // sRGB is what CSS blends legacy colors in already.
  const interpolation = space === 'srgb' ? '' : ` in ${space}`
  return `linear-gradient(${direction}${interpolation}, ${css.join(', ')})`
}

function gradient(direction: string, colors: Color[], space: RenderColorSpace): string {
  return linearGradientCSS(
    direction,
    colors.map((color) => ({ color })),
    space
  )
}

const HUES = [0, 60, 120, 180, 240, 300, 360]

/** The colors a slider of `channel` runs through, as Reka draws its track. */
function trackColors(color: RekaColor, channel: ColorChannel, model: RekaColorSpace): RekaColor[] {
  const opaque = { ...color, alpha: 1 }
  const hsl = convertToHsl(opaque)
  const hsb = convertToHsb(opaque)
  switch (channel) {
    case 'hue':
      return HUES.map((h) => ({ space: 'hsb', h, s: 100, b: 100, alpha: 1 }))
    case 'saturation': {
      const l = model === 'hsl' ? hsl.l : 50
      return [0, 100].map((s) => ({ ...hsl, s, l }))
    }
    case 'lightness':
      return [0, 50, 100].map((l) => ({ ...hsl, l }))
    case 'brightness':
      return [0, 100].map((b) => ({ ...hsb, b }))
    case 'alpha':
      return [0, 1].map((alpha) => ({ ...convertToRgb(color), alpha }))
    default: {
      const { min, max } = getChannelRange(channel)
      return [min, max].map((value) => setChannelValue(opaque, channel, value))
    }
  }
}

const CHECKERBOARD = [
  'linear-gradient(45deg, #ccc 25%, transparent 25%)',
  'linear-gradient(-45deg, #ccc 25%, transparent 25%)',
  'linear-gradient(45deg, transparent 75%, #ccc 75%)',
  'linear-gradient(-45deg, transparent 75%, #ccc 75%)'
].join(', ')

/**
 * The background of a color slider's track in a profile other than sRGB, whose colors Reka can
 * only write as sRGB; `undefined` in sRGB, where Reka's own track is right.
 */
export function sliderTrackBackground(
  color: RekaColor,
  channel: ColorChannel,
  model: RekaColorSpace,
  space: RenderColorSpace
): string | undefined {
  if (space === 'srgb') return undefined
  const track = gradient('to right', trackColors(color, channel, model).map(sceneColor), space)
  return channel === 'alpha' ? `${track}, ${CHECKERBOARD}` : track
}

/**
 * The style of a saturation-by-brightness area of hue `h` in a profile other than sRGB: white to
 * the full hue across, darkened toward black downward. `undefined` in sRGB, where Reka's own style is right.
 */
export function saturationBrightnessArea(
  h: number,
  space: RenderColorSpace
): Record<string, string> | undefined {
  if (space === 'srgb') return undefined
  const hue = sceneColor({ space: 'hsb', h, s: 100, b: 100, alpha: 1 })
  const white = { r: 1, g: 1, b: 1, a: 1 }
  return {
    backgroundColor: 'transparent',
    backgroundImage: `linear-gradient(to top, #000000, transparent), ${gradient('to right', [white, hue], space)}`
  }
}
