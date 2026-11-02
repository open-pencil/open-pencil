import { clamp } from 'es-toolkit'
import * as v from 'valibot'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { remToPx } from './root-font-size'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
/**
 * The left panel's share of the window, in percent, when the editor first opens at the default
 * interface size; a larger interface widens it by the same factor.
 */
const DEFAULT_LEFT_PANEL = 18
/** The root font size the left panel's share is set for. */
const DEFAULT_REM_PX = 16
/**
 * How wide the right panel opens, in rem, whatever the window's width: wide enough for its fields
 * and the AI chat at the interface size, without growing on a large screen as a share would.
 */
const DEFAULT_RIGHT_PANEL_REM = 16
/** The window width a layout is made for before there is a window, as in tests. */
const NOMINAL_WINDOW_WIDTH = 1280

/** Left panel, canvas, and right panel, in percent of the window, as the splitter takes them. */
function defaultEditorLayout(): number[] {
  const width = IS_BROWSER && window.innerWidth > 0 ? window.innerWidth : NOMINAL_WINDOW_WIDTH
  // Within the panels' own limits in EditorWorkspace.vue.
  const left = clamp((DEFAULT_LEFT_PANEL * remToPx(1)) / DEFAULT_REM_PX, 10, 30)
  const right = clamp((remToPx(DEFAULT_RIGHT_PANEL_REM) / width) * 100, 10, 30)
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
