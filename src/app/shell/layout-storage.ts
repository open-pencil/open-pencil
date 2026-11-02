import { clamp } from 'es-toolkit'
import * as v from 'valibot'

import { IS_BROWSER } from '@open-pencil/core/constants'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
/** The left panel's share of the window, in percent, when the editor first opens. */
const DEFAULT_LEFT_PANEL = 18
/**
 * How wide the right panel opens, in pixels, whatever the window's width: wide enough for its
 * fields and the AI chat, without growing on a large screen as a share of the window would.
 */
const DEFAULT_RIGHT_PANEL_WIDTH = 256
/** The window width a layout is made for before there is a window, as in tests. */
const NOMINAL_WINDOW_WIDTH = 1280

/** Left panel, canvas, and right panel, in percent of the window, as the splitter takes them. */
function defaultEditorLayout(): number[] {
  const width = IS_BROWSER && window.innerWidth > 0 ? window.innerWidth : NOMINAL_WINDOW_WIDTH
  // Within the right panel's own limits in EditorWorkspace.vue.
  const right = clamp((DEFAULT_RIGHT_PANEL_WIDTH / width) * 100, 10, 30)
  return [DEFAULT_LEFT_PANEL, 100 - DEFAULT_LEFT_PANEL - right, right]
}

const editorLayoutSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.strictTuple([v.number(), v.number(), v.number()])
)

export function loadEditorLayout(): number[] {
  if (!IS_BROWSER) return defaultEditorLayout()
  try {
    const parsed = v.safeParse(editorLayoutSchema, window.localStorage.getItem(EDITOR_LAYOUT_KEY))
    return parsed.success ? parsed.output : defaultEditorLayout()
  } catch {
    return defaultEditorLayout()
  }
}

export function saveEditorLayout(layout: number[]): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify(layout))
}
