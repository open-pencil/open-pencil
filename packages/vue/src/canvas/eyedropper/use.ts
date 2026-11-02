import { useElementHover, useMouseInElement, useRafFn } from '@vueuse/core'
import {
  computed,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef
} from 'vue'

import { scenePixelColor } from '@open-pencil/core'
import type { Editor, ScenePixels } from '@open-pencil/core'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { sampleEyedropperPixels } from './sample'

/** How many screen pixels a side the loupe shows; odd, so one pixel is the centre. */
export const EYEDROPPER_LOUPE_PIXELS = 9

/**
 * A loupe that stands in for the cursor while the eyedropper is active over the canvas: centred
 * on the pointer, so the outlined centre pixel is the one a click picks. The pointer cursor
 * itself should be hidden while it shows, or the cursor, drawn by the system ahead of the page,
 * appears to run ahead of the loupe.
 */
export interface EyedropperLoupe {
  /** Whether the loupe has pixels to show: the eyedropper is active with the pointer on the canvas. */
  visible: ComputedRef<boolean>
  /** The pointer in viewport (client) coordinates, updated with each move. */
  clientX: ShallowRef<number>
  clientY: ShallowRef<number>
  /** The screen pixels around the pointer, sampled once a frame from the document alone. */
  pixels: ShallowRef<ScenePixels | null>
  /** The centre pixel's colour: what a click picks. */
  color: ComputedRef<Color | null>
}

/**
 * Tracks the pointer over a canvas while the eyedropper is active. The position follows each
 * move at once; the pixels are sampled on the next frame, and again only when the pointer, the
 * view, or the page changed, so a still pointer costs nothing. `enabled` is false for a canvas
 * that takes no input, such as a split view's inactive pane.
 */
export function useEyedropperLoupe(
  editor: Editor,
  canvas: Readonly<Ref<HTMLElement | null | undefined>>,
  enabled: MaybeRefOrGetter<boolean> = true
): EyedropperLoupe {
  const pointer = useMouseInElement(canvas, { handleOutside: false, type: 'client' })
  const hovered = useElementHover(canvas)
  const active = computed(
    () => toValue(enabled) && hovered.value && editor.state.activeTool === 'EYEDROPPER'
  )
  const pixels = shallowRef<ScenePixels | null>(null)
  let sampledAt = ''

  const { pause, resume } = useRafFn(
    () => {
      const sx = pointer.elementX.value
      const sy = pointer.elementY.value
      const { zoom, panX, panY, currentPageId } = editor.state
      const at = `${sx} ${sy} ${zoom} ${panX} ${panY} ${currentPageId}`
      if (at === sampledAt) return
      sampledAt = at
      const { x, y } = editor.screenToCanvas(sx, sy)
      pixels.value = sampleEyedropperPixels(editor, x, y, EYEDROPPER_LOUPE_PIXELS)
    },
    { immediate: false }
  )

  watch(
    active,
    (shown) => {
      if (shown) return resume()
      pause()
      pixels.value = null
      sampledAt = ''
    },
    { immediate: true }
  )

  const centre = (EYEDROPPER_LOUPE_PIXELS - 1) / 2
  const color = computed(() =>
    pixels.value ? scenePixelColor(pixels.value, centre, centre) : null
  )

  return {
    visible: computed(() => active.value && color.value !== null),
    clientX: pointer.x,
    clientY: pointer.y,
    pixels,
    color
  }
}
