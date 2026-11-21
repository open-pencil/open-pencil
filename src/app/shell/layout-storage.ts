import { clamp } from 'es-toolkit'
import * as v from 'valibot'

import { IS_BROWSER } from '@open-pencil/core/constants'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
/** The left panel's share of the window, in percent, when the editor first opens. */
const DEFAULT_LEFT_PANEL = 18
/**
 * The root font size of the default interface size. The layout nobody saved is made for it rather
 * than for the interface size when the editor mounts, which depends on whether the size was applied
 * yet; a larger interface widens the panels through their minimum widths (`EditorWorkspace.vue`),
 * and returning to the default gives back this layout.
 */
const DEFAULT_REM_PX = 16
/**
 * How wide the right panel opens, in rem of the default interface size, whatever the window's
 * width: wide enough for its fields and the AI chat, without growing on a large screen as a share
 * would.
 */
const DEFAULT_RIGHT_PANEL_REM = 16
/** The window width a layout is made for before there is a window, as in tests. */
const NOMINAL_WINDOW_WIDTH = 1280

/** Left panel, canvas, and right panel, in percent of the window, as the splitter takes them. */
function defaultEditorLayout(): number[] {
  const width = IS_BROWSER && window.innerWidth > 0 ? window.innerWidth : NOMINAL_WINDOW_WIDTH
  // Within the panels' own limits in EditorWorkspace.vue.
  const left = DEFAULT_LEFT_PANEL
  const right = clamp(((DEFAULT_RIGHT_PANEL_REM * DEFAULT_REM_PX) / width) * 100, 10, 30)
  return [left, 100 - left - right, right]
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
