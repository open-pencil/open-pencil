import * as v from 'valibot'

import { IS_BROWSER } from '@open-pencil/core/constants'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
/** Left panel, canvas, and right panel, in percent; the right one is wider for the AI chat. */
const DEFAULT_EDITOR_LAYOUT = [18, 60, 22]
const editorLayoutSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.strictTuple([v.number(), v.number(), v.number()])
)

export function loadEditorLayout(): number[] {
  if (!IS_BROWSER) return DEFAULT_EDITOR_LAYOUT
  try {
    const parsed = v.safeParse(editorLayoutSchema, window.localStorage.getItem(EDITOR_LAYOUT_KEY))
    return parsed.success ? parsed.output : DEFAULT_EDITOR_LAYOUT
  } catch {
    return DEFAULT_EDITOR_LAYOUT
  }
}

export function saveEditorLayout(layout: number[]): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify(layout))
}
