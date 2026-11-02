import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'

import {
  applySampledColor,
  resolveEditorProfile,
  sampleScenePixels,
  scenePixelColor
} from '@open-pencil/core/editor'
import type { Editor, EyedropperTarget, ScenePixels } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** How many screen pixels a side the loupe shows; odd, so one pixel is the centre. */
export const EYEDROPPER_LOUPE_PIXELS = 9

/** What the eyedropper would pick under the pointer, and the screen pixels around it. */
export interface EyedropperPreview {
  /** The pointer in the canvas's screen coordinates. */
  sx: number
  sy: number
  pixels: ScenePixels
  /** The centre pixel's colour: what a click picks. */
  color: Color
}

interface SampleRequest {
  resolve: (color: Color | null) => void
  stop: () => void
}

/** The request a color picker waits on, per editor; a new request replaces the old one. */
const requests = new WeakMap<Editor, SampleRequest>()
const previews = new WeakMap<Editor, ShallowRef<EyedropperPreview | null>>()
/** The pointer a preview waits to sample on the next frame, per editor. */
const pendingPoints = new WeakMap<Editor, { sx: number; sy: number }>()

function settle(editor: Editor, color: Color | null) {
  const request = requests.get(editor)
  if (!request) return
  requests.delete(editor)
  request.stop()
  request.resolve(color)
}

function previewOf(editor: Editor): ShallowRef<EyedropperPreview | null> {
  const existing = previews.get(editor)
  if (existing) return existing
  const preview = shallowRef<EyedropperPreview | null>(null)
  editor.onEditorEvent('tool:changed', (tool) => {
    if (tool !== 'EYEDROPPER') clearEyedropperPreview(editor)
  })
  previews.set(editor, preview)
  return preview
}

/** The screen pixels around a world point at the view's zoom, the centre one sampled. */
function sampleAt(editor: Editor, cx: number, cy: number, size: number): ScenePixels | null {
  const renderer = editor.renderer
  if (!renderer) return null
  const { currentPageId, zoom } = editor.state
  return sampleScenePixels(renderer.ck, renderer, editor.graph, currentPageId, cx, cy, size, zoom)
}

/** Whether the editor's profile offers the eyedropper; boards and read-only documents do not. */
export function offersEyedropper(editor: Editor): boolean {
  const { tools } = resolveEditorProfile(editor.state)
  return !tools || tools.has('EYEDROPPER')
}

/**
 * Switches to the eyedropper and resolves with the next color picked on the canvas instead of
 * applying it to the selection; `null` when the user leaves the tool or the request is cancelled.
 */
export function requestEyedropperSample(editor: Editor): Promise<Color | null> {
  settle(editor, null)
  editor.setTool('EYEDROPPER')
  if (editor.state.activeTool !== 'EYEDROPPER') return Promise.resolve(null)
  return new Promise((resolve) => {
    // Subscribed after switching, so the switch to the eyedropper itself does not cancel.
    const stop = editor.onEditorEvent('tool:changed', () => settle(editor, null))
    requests.set(editor, { resolve, stop })
  })
}

/** Gives up a waiting request, as when its picker closes, and leaves the eyedropper. */
export function cancelEyedropperSample(editor: Editor) {
  if (!requests.has(editor)) return
  settle(editor, null)
  if (editor.state.activeTool === 'EYEDROPPER') editor.setTool('SELECT')
}

/**
 * Whether a press answers a picker's request: one on the canvas while a request waits. A picker
 * passes it as `keepOpen`, so the press that samples does not dismiss it.
 */
export function pressAnswersEyedropper(editor: Editor, event: PointerEvent): boolean {
  return requests.has(editor) && event.target instanceof HTMLCanvasElement
}

/**
 * A click with the eyedropper: answers a waiting picker request, otherwise paints the selection's
 * fill (Alt: stroke) in one undo step. Either way the Move tool comes back.
 */
export function handleEyedropperDown(editor: Editor, cx: number, cy: number, altKey: boolean) {
  const pixels = sampleAt(editor, cx, cy, 1)
  const color = pixels ? scenePixelColor(pixels, 0, 0) : null
  if (requests.has(editor)) {
    // Resolve before the tool switch, which would otherwise cancel the request.
    settle(editor, color)
  } else if (color) {
    const target: EyedropperTarget = altKey ? 'stroke' : 'fill'
    applySampledColor(editor, color, target)
  }
  editor.setTool('SELECT')
}

/**
 * Samples the loupe at a screen point on the next frame; moves within one frame sample once.
 * Call it again after the view changes under a still pointer.
 */
export function previewEyedropper(editor: Editor, sx: number, sy: number) {
  const scheduled = pendingPoints.has(editor)
  pendingPoints.set(editor, { sx, sy })
  if (scheduled) return
  requestAnimationFrame(() => {
    const point = pendingPoints.get(editor)
    pendingPoints.delete(editor)
    if (!point || editor.state.activeTool !== 'EYEDROPPER') return
    const { x, y } = editor.screenToCanvas(point.sx, point.sy)
    const pixels = sampleAt(editor, x, y, EYEDROPPER_LOUPE_PIXELS)
    const centre = (EYEDROPPER_LOUPE_PIXELS - 1) / 2
    previewOf(editor).value = pixels
      ? { ...point, pixels, color: scenePixelColor(pixels, centre, centre) }
      : null
  })
}

/** Hides the loupe, as when the pointer leaves the canvas or the tool changes. */
export function clearEyedropperPreview(editor: Editor) {
  pendingPoints.delete(editor)
  const preview = previews.get(editor)
  if (preview) preview.value = null
}

/** The loupe's state for an editor: what the pointer is over while the eyedropper is active. */
export function useEyedropperPreview(editor: Editor): ComputedRef<EyedropperPreview | null> {
  const preview = previewOf(editor)
  return computed(() => preview.value)
}
