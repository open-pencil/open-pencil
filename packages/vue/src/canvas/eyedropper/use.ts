import { useElementHover, useMouseInElement, useRafFn } from '@vueuse/core'
import { computed, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'

import { scenePixelColor } from '@open-pencil/core/editor'
import type { Editor, ScenePixels } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { sampleEyedropperPixels } from './sample'

/** How many screen pixels a side the loupe shows; odd, so one pixel is the centre. */
export const EYEDROPPER_LOUPE_PIXELS = 9

/** What a loupe beside the pointer shows while the eyedropper is active over the canvas. */
export interface EyedropperLoupe {
  /** Whether the eyedropper is active with the pointer over the canvas. */
  visible: ComputedRef<boolean>
  /** The pointer in the canvas's own coordinates, updated with each move. */
  x: ShallowRef<number>
  y: ShallowRef<number>
  /** The canvas's size, to keep the loupe inside it. */
  width: ShallowRef<number>
  height: ShallowRef<number>
  /** The screen pixels around the pointer, sampled once a frame from the document alone. */
  pixels: ShallowRef<ScenePixels | null>
  /** The centre pixel's colour: what a click picks. */
  color: ComputedRef<Color | null>
}

/**
 * Tracks the pointer over a canvas while the eyedropper is active. The position follows each
 * move at once; the pixels are sampled on the next frame, and again only when the pointer or the
 * view moved, so a still pointer costs nothing.
 */
export function useEyedropperLoupe(
  editor: Editor,
  canvas: Readonly<Ref<HTMLElement | null | undefined>>
): EyedropperLoupe {
  const pointer = useMouseInElement(canvas, { handleOutside: false })
  const hovered = useElementHover(canvas)
  const visible = computed(() => hovered.value && editor.state.activeTool === 'EYEDROPPER')
  const pixels = shallowRef<ScenePixels | null>(null)
  let sampledAt = ''

  const { pause, resume } = useRafFn(
    () => {
      const sx = pointer.elementX.value
      const sy = pointer.elementY.value
      const { zoom, panX, panY } = editor.state
      const at = `${sx} ${sy} ${zoom} ${panX} ${panY}`
      if (at === sampledAt) return
      sampledAt = at
      const { x, y } = editor.screenToCanvas(sx, sy)
      pixels.value = sampleEyedropperPixels(editor, x, y, EYEDROPPER_LOUPE_PIXELS)
    },
    { immediate: false }
  )

  watch(
    visible,
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
    visible,
    x: pointer.elementX,
    y: pointer.elementY,
    width: pointer.elementWidth,
    height: pointer.elementHeight,
    pixels,
    color
  }
}
