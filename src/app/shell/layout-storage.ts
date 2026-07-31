import { IS_BROWSER } from '@open-pencil/core/constants'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
const SLIDES_LAYOUT_KEY = 'open-pencil:slides-layout'

/** Design mode: left | canvas | right */
const DEFAULT_EDITOR_LAYOUT = [18, 64, 18]
/**
 * Slides / deck mode: wider filmstrip, canvas, right panel at minimum.
 * Right panel min-size in EditorView is 10.
 */
const DEFAULT_SLIDES_LAYOUT = [22, 68, 10]

function readLayout(key: string, fallback: number[]): number[] {
  if (!IS_BROWSER) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((v) => typeof v === 'number')
      ? parsed
      : fallback
  } catch {
    return fallback
  }
}

export function loadEditorLayout(): number[] {
  return readLayout(EDITOR_LAYOUT_KEY, DEFAULT_EDITOR_LAYOUT)
}

export function saveEditorLayout(layout: number[]): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify(layout))
}

export function loadSlidesLayout(): number[] {
  return readLayout(SLIDES_LAYOUT_KEY, DEFAULT_SLIDES_LAYOUT)
}

export function saveSlidesLayout(layout: number[]): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(SLIDES_LAYOUT_KEY, JSON.stringify(layout))
}

export { DEFAULT_EDITOR_LAYOUT, DEFAULT_SLIDES_LAYOUT }
