import { applySampledColor, sampleSceneColor } from '@open-pencil/core/editor'
import type { Editor, EyedropperTarget } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/scene-graph/primitives'

interface SampleRequest {
  resolve: (color: Color | null) => void
  stop: () => void
}

interface EyedropperSession {
  request: SampleRequest | null
  settledAt: number
}

/**
 * Reka reports focus moving outside a popover a tick or two late, after the canvas click that
 * answered the request took focus; dismissals within this window still belong to the sample.
 */
const DISMISS_GRACE_MS = 250

const sessions = new WeakMap<Editor, EyedropperSession>()

function sessionOf(editor: Editor): EyedropperSession {
  const existing = sessions.get(editor)
  if (existing) return existing
  const session: EyedropperSession = { request: null, settledAt: Number.NEGATIVE_INFINITY }
  sessions.set(editor, session)
  return session
}

function settle(editor: Editor, color: Color | null) {
  const session = sessionOf(editor)
  const { request } = session
  if (!request) return
  session.request = null
  session.settledAt = performance.now()
  request.stop()
  request.resolve(color)
}

/**
 * Switches to the eyedropper and resolves with the next color picked on the canvas instead of
 * applying it to the selection; `null` when the user cancels or picks another tool.
 */
export function requestEyedropperSample(editor: Editor): Promise<Color | null> {
  settle(editor, null)
  return new Promise((resolve) => {
    // Subscribed after switching, so the switch to the eyedropper itself does not cancel.
    editor.setTool('EYEDROPPER')
    const stop = editor.onEditorEvent('tool:changed', () => {
      if (editor.state.activeTool !== 'EYEDROPPER') settle(editor, null)
    })
    sessionOf(editor).request = { resolve, stop }
  })
}

/** The color the document shows at a canvas point, or null without a renderer. */
function sampleCanvasColor(editor: Editor, cx: number, cy: number): Color | null {
  const renderer = editor.renderer
  if (!renderer) return null
  return sampleSceneColor(renderer.ck, renderer, editor.graph, editor.state.currentPageId, cx, cy)
}

/**
 * A click with the eyedropper: answers a pending picker request, otherwise paints the
 * selection's fill (Alt: stroke) in one undo step. Either way the move tool comes back.
 */
export function handleEyedropperDown(editor: Editor, cx: number, cy: number, altKey: boolean) {
  const color = sampleCanvasColor(editor, cx, cy)
  if (sessionOf(editor).request) {
    // Resolve before the tool switch, which would otherwise cancel the request.
    settle(editor, color)
  } else if (color) {
    const target: EyedropperTarget = altKey ? 'stroke' : 'fill'
    applySampledColor(editor, color, target)
  }
  editor.setTool('SELECT')
}

/**
 * Whether a color picker should stay open through a dismissal: while it waits for a canvas
 * sample, and for the moment after one, when the late focus change reaches it.
 */
export function holdsPickerOpen(editor: Editor): boolean {
  const { request, settledAt } = sessionOf(editor)
  return request !== null || performance.now() - settledAt < DISMISS_GRACE_MS
}
