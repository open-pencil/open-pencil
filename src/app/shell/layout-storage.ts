import { IS_BROWSER } from '@open-pencil/core/constants'

const EDITOR_LAYOUT_KEY = 'open-pencil:editor-layout'
const SLIDES_LAYOUT_KEY = 'open-pencil:slides-layout'
const SLIDES_NOTES_LAYOUT_KEY = 'open-pencil:slides-notes-layout'

/** Design mode: left | canvas | right */
const DEFAULT_EDITOR_LAYOUT = [18, 64, 18]
/**
 * Slides / deck mode: wider filmstrip, canvas, right panel at minimum.
 * Right panel min-size in EditorView is 10.
 */
const DEFAULT_SLIDES_LAYOUT = [22, 68, 10]

export interface SlidesNotesLayout {
  /** Height of the notes pane as a percent of the canvas panel. */
  size: number
  collapsed: boolean
}

/**
 * Notes-pane state is kept under its own key on purpose: `readLayout` validates
 * `parsed.length === 3`, so adding a fourth element to the slides layout would silently
 * discard the whole stored layout.
 */
const DEFAULT_SLIDES_NOTES_LAYOUT: SlidesNotesLayout = { size: 30, collapsed: false }

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

export function loadSlidesNotesLayout(): SlidesNotesLayout {
  if (!IS_BROWSER) return { ...DEFAULT_SLIDES_NOTES_LAYOUT }
  try {
    const raw = window.localStorage.getItem(SLIDES_NOTES_LAYOUT_KEY)
    if (!raw) return { ...DEFAULT_SLIDES_NOTES_LAYOUT }
    const parsed = JSON.parse(raw) as Partial<SlidesNotesLayout>
    const size =
      typeof parsed.size === 'number' && parsed.size > 0 && parsed.size <= 50
        ? parsed.size
        : DEFAULT_SLIDES_NOTES_LAYOUT.size
    const collapsed = parsed.collapsed === true
    return { size, collapsed }
  } catch {
    return { ...DEFAULT_SLIDES_NOTES_LAYOUT }
  }
}

export function saveSlidesNotesLayout(layout: SlidesNotesLayout): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(SLIDES_NOTES_LAYOUT_KEY, JSON.stringify(layout))
}

export { DEFAULT_EDITOR_LAYOUT, DEFAULT_SLIDES_LAYOUT }
