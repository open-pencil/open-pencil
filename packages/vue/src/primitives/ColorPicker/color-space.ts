import { convertToHsb, convertToHsl, convertToRgb, getChannelRange, setChannelValue } from 'reka-ui'
import type { Color as RekaColor, ColorChannel, ColorSpace as RekaColorSpace } from 'reka-ui'
import { computed, hasInjectionContext, inject, provide, toValue } from 'vue'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue'

import { colorToDisplayCSS, type RenderColorSpace } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** The profile colors are stored in, and the one the canvas beside them presents them in. */
export interface ColorSpaces {
  stored: RenderColorSpace
  shown: RenderColorSpace
}

const SRGB: ColorSpaces = { stored: 'srgb', shown: 'srgb' }

const COLOR_SPACES_KEY: InjectionKey<() => ColorSpaces> = Symbol('open-pencil-color-spaces')

/**
 * Declares the profile the colors in this subtree are stored in, and the one to show them in:
 * what the canvas presents, so swatches, picker tracks, and gradient stops match it. A Display P3
 * document on a canvas that can present P3 shows its colors as P3; on one that falls back to
 * sRGB, they clip as the canvas clips them. `shown` defaults to `stored`. Unprovided, colors are
 * sRGB, as a preference's are.
 */
export function provideColorSpace(
  stored: MaybeRefOrGetter<RenderColorSpace>,
  shown: MaybeRefOrGetter<RenderColorSpace> = stored
): void {
  provide(COLOR_SPACES_KEY, () => ({ stored: toValue(stored), shown: toValue(shown) }))
}

/**
 * The profiles {@link provideColorSpace} declared for this subtree, sRGB when none did or when
 * called outside a component.
 */
export function useColorSpaces(): ComputedRef<ColorSpaces> {
  const srgb = () => SRGB
  const spaces = hasInjectionContext() ? inject(COLOR_SPACES_KEY, srgb) : srgb
  return computed(() => spaces())
}

/** The profile colors in this subtree are stored in, which their values are read and made in. */
export function useColorSpace(): ComputedRef<RenderColorSpace> {
  const spaces = useColorSpaces()
  return computed(() => spaces.value.stored)
}

/** `color`, whose components are in `spaces.stored`, as CSS showing it in `spaces.shown`. */
export function colorCSS(color: Color, spaces: ColorSpaces): string {
  return colorToDisplayCSS(color, { documentColorSpace: spaces.stored, colorSpace: spaces.shown })
}

/** {@link colorCSS} in the profiles of this subtree. */
export function useColorCSS(): (color: Color) => string {
  const spaces = useColorSpaces()
  return (color) => colorCSS(color, spaces.value)
}

function sceneColor(color: RekaColor): Color {
  const { r, g, b, alpha } = convertToRgb(color)
  return { r: r / 255, g: g / 255, b: b / 255, a: alpha }
}

/** Stops between two given ones when colors are shown in another profile than they are stored in. */
const CLIPPED_SAMPLES = 8

type GradientStop = { color: Color; position?: number }

function mix(from: Color, to: Color, t: number): Color {
  const at = (key: keyof Color) => from[key] + (to[key] - from[key]) * t
  return { r: at('r'), g: at('g'), b: at('b'), a: at('a') }
}

/**
 * Where CSS draws stops of these `positions`: an omitted first or last one at an end, a run of
 * omitted ones spread evenly between the stops around it, and none before the one ahead of it.
 */
function cssStopPositions(positions: ReadonlyArray<number | undefined>): number[] {
  const placed = positions.map((position, index) => {
    if (position !== undefined) return position
    if (index === 0) return 0
    return index === positions.length - 1 ? 1 : undefined
  })
  let ahead = 0
  for (const [index, position] of placed.entries()) {
    if (position !== undefined) {
      ahead = Math.max(ahead, position)
      placed[index] = ahead
      continue
    }
    const end = placed.findIndex((next, at) => at > index && next !== undefined)
    const to = Math.max(placed[end] ?? 1, ahead)
    const span = end - index + 1
    for (let at = index; at < end; at++)
      placed[at] = ahead + ((to - ahead) * (at - index + 1)) / span
  }
  return placed.map((position) => position ?? 1)
}

/**
 * `stops` with positions, and, when colors are shown in another profile, the colors between
 * each pair blended in the stored components: a CSS blend of the clipped ends would leave the
 * colors the document blends to, as a P3 red clipped to sRGB, blended with white.
 */
function placedStops(
  stops: ReadonlyArray<GradientStop>,
  spaces: ColorSpaces
): ReadonlyArray<GradientStop> {
  if (spaces.stored === spaces.shown) return stops
  const positions = cssStopPositions(stops.map((stop) => stop.position))
  const placed = stops.map((stop, index) => ({ color: stop.color, position: positions[index] }))
  return placed.flatMap((stop, index) => {
    if (index === placed.length - 1) return [stop]
    const next = placed[index + 1]
    return Array.from({ length: CLIPPED_SAMPLES }, (_, step) => {
      const t = step / CLIPPED_SAMPLES
      return {
        color: mix(stop.color, next.color, t),
        position: stop.position + (next.position - stop.position) * t
      }
    })
  })
}

/**
 * A CSS linear gradient through `stops`, each at its `position` from 0 to 1 or spread evenly,
 * blended in the components the colors are stored in, as the canvas blends a gradient fill.
 */
export function linearGradientCSS(
  direction: string,
  stops: ReadonlyArray<GradientStop>,
  spaces: ColorSpaces
): string {
  const css = placedStops(stops, spaces).map(({ color, position }) =>
    position === undefined
      ? colorCSS(color, spaces)
      : `${colorCSS(color, spaces)} ${position * 100}%`
  )
  // sRGB colors shown as sRGB are legacy CSS colors, which CSS blends in sRGB already; any
  // other stop would blend in Oklab unless told the stored profile.
  const interpolation = isSRGB(spaces) ? '' : ` in ${spaces.stored}`
  return `linear-gradient(${direction}${interpolation}, ${css.join(', ')})`
}

function gradient(direction: string, colors: Color[], spaces: ColorSpaces): string {
  return linearGradientCSS(
    direction,
    colors.map((color) => ({ color })),
    spaces
  )
}

function isSRGB(spaces: ColorSpaces): boolean {
  return spaces.stored === 'srgb' && spaces.shown === 'srgb'
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
 * The background of a color slider's track for colors stored or shown in a profile other than
 * sRGB, which Reka cannot write; `undefined` in sRGB, where Reka's own track is right.
 */
export function sliderTrackBackground(
  color: RekaColor,
  channel: ColorChannel,
  model: RekaColorSpace,
  spaces: ColorSpaces
): string | undefined {
  if (isSRGB(spaces)) return undefined
  const track = gradient('to right', trackColors(color, channel, model).map(sceneColor), spaces)
  return channel === 'alpha' ? `${track}, ${CHECKERBOARD}` : track
}

/**
 * The style of a saturation-by-brightness area of hue `h` for colors stored or shown in a profile
 * other than sRGB: white to the full hue across, darkened toward black downward. `undefined` in
 * sRGB, where Reka's own style is right.
 */
export function saturationBrightnessArea(
  h: number,
  spaces: ColorSpaces
): Record<string, string> | undefined {
  if (isSRGB(spaces)) return undefined
  const hue = sceneColor({ space: 'hsb', h, s: 100, b: 100, alpha: 1 })
  const white = { r: 1, g: 1, b: 1, a: 1 }
  return {
    backgroundColor: 'transparent',
    backgroundImage: `linear-gradient(to top, #000000, transparent), ${gradient('to right', [white, hue], spaces)}`
  }
}
