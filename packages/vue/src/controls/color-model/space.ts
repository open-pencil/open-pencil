import {
  computed,
  hasInjectionContext,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  toValue
} from 'vue'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, ShallowRef } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { ColorProfile } from '@open-pencil/scene-graph'
import { colorToProfileCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** The profile colors are stored in, and the one the canvas beside them presents them in. */
export interface ColorSpaces {
  stored: ColorProfile
  shown: ColorProfile
}

/** Colors stored and shown in sRGB, as an interface color or a preference is. */
export const SRGB_SPACES: ColorSpaces = { stored: 'srgb', shown: 'srgb' }

const COLOR_SPACES_KEY: InjectionKey<() => ColorSpaces> = Symbol('open-pencil-color-spaces')

/**
 * Declares the profile the colors in this subtree are stored in, and the one to show them in:
 * what the canvas presents, so swatches, picker tracks, and gradient stops match it. A Display P3
 * document on a canvas that can present P3 shows its colors as P3; on one that falls back to
 * sRGB, they clip as the canvas clips them. `shown` defaults to `stored`. Unprovided, colors are
 * sRGB, as a preference's are.
 */
export function provideColorSpace(
  stored: MaybeRefOrGetter<ColorProfile>,
  shown: MaybeRefOrGetter<ColorProfile> = stored
): void {
  provide(COLOR_SPACES_KEY, () => ({ stored: toValue(stored), shown: toValue(shown) }))
}

/**
 * The profiles {@link provideColorSpace} declared for this subtree, sRGB when none did or when
 * called outside a component.
 */
export function useColorSpaces(): ComputedRef<ColorSpaces> {
  const srgb = () => SRGB_SPACES
  const spaces = hasInjectionContext() ? inject(COLOR_SPACES_KEY, srgb) : srgb
  return computed(() => spaces())
}

/** The profile colors in this subtree are stored in, which their values are read and made in. */
export function useColorSpace(): ComputedRef<ColorProfile> {
  const spaces = useColorSpaces()
  return computed(() => spaces.value.stored)
}

/** `color`, whose components are in `spaces.stored`, as CSS showing it in `spaces.shown`. */
export function colorCSS(color: Color, spaces: ColorSpaces): string {
  return colorToProfileCSS(color, spaces.stored, spaces.shown)
}

/** {@link colorCSS} in the profiles of this subtree. */
export function useColorCSS(): (color: Color) => string {
  const spaces = useColorSpaces()
  return (color) => colorCSS(color, spaces.value)
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

/** Whether colors are both stored and shown in sRGB, which CSS and Reka draw as they are. */
export function isSRGB(spaces: ColorSpaces): boolean {
  return spaces.stored === 'srgb' && spaces.shown === 'srgb'
}

const PRESENTATION_KEY: InjectionKey<ShallowRef<ColorProfile | null>> = Symbol(
  'open-pencil-canvas-presentation'
)

/**
 * Provides `editor`'s document profile as the profile colors are stored in, and the profile its
 * canvas reports presenting, through {@link reportCanvasPresentation}, as the one they are shown
 * in. `provideEditor` calls this, so swatches and pickers under it match the canvas.
 */
export function provideEditorColorSpaces(editor: Editor): void {
  // Read when a color is shown, not now: an editor that follows the active document may have none
  // yet. The events only mark the profile as changed.
  const changes = shallowRef(0)
  const changed = () => {
    changes.value++
  }
  const stops = [
    editor.onEditorEvent('document:color-space-changed', changed),
    editor.onEditorEvent('graph:replaced', changed)
  ]
  onScopeDispose(() => {
    for (const stop of stops) stop()
  })
  const stored = () => {
    void changes.value
    return editor.graph.documentColorSpace
  }
  const presentation = shallowRef<ColorProfile | null>(null)
  provide(PRESENTATION_KEY, presentation)
  provideColorSpace(stored, () => presentation.value ?? stored())
}

/**
 * Gives this subtree a presentation report of its own, which nothing reads, for an editor whose
 * host tracks the shown profile itself: its canvas's reports then stay out of an outer editor's.
 */
export function isolateCanvasPresentation(): void {
  provide(PRESENTATION_KEY, shallowRef<ColorProfile | null>(null))
}

/**
 * The function a canvas calls with the profile it presents in, or null once it stops, for the
 * spaces {@link provideEditorColorSpaces} provides. Does nothing outside such a subtree.
 */
export function reportCanvasPresentation(): (presentation: ColorProfile | null) => void {
  const presentation = hasInjectionContext() ? inject(PRESENTATION_KEY, null) : null
  return (value) => {
    if (presentation) presentation.value = value
  }
}
