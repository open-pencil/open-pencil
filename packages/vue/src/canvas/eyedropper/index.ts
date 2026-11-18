import { applySampledColor, resolveEditorProfile, scenePixelColor } from '@open-pencil/core'
import type { Editor, EyedropperTarget } from '@open-pencil/core'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { sampleEyedropperPixels } from './sample'

interface SampleRequest {
  resolve: (color: Color | null) => void
  stop: () => void
}

/** The request a color picker waits on, per editor; a new request replaces the old one. */
const requests = new WeakMap<Editor, SampleRequest>()

function settle(editor: Editor, color: Color | null) {
  const request = requests.get(editor)
  if (!request) return
  requests.delete(editor)
  request.stop()
  request.resolve(color)
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
  const pixels = sampleEyedropperPixels(editor, cx, cy, 1)
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

export { EYEDROPPER_LOUPE_PIXELS, useEyedropperLoupe } from './use'
export type { EyedropperLoupe } from './use'
