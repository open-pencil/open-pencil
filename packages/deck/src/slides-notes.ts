import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * The raw canvas field carrying a slide's speaker notes.
 *
 * Notes are authored content with no scene-graph shape, so they ride on the page node as a
 * raw field and are handed back to the SLIDE on export (`applyImportedCanvasFields`). This
 * helper is the one place the editor reads and writes them; the format work stays in the
 * carried-fields path.
 */
export const SLIDE_SPEAKER_NOTES_FIELD = 'slideSpeakerNotes'

/** The current notes of a slide (its page node), or '' when the slide has none. */
export function getSlideSpeakerNotes(page: SceneNode | undefined): string {
  if (!page) return ''
  const value = page.source.fig.rawNodeFields[SLIDE_SPEAKER_NOTES_FIELD]
  return typeof value === 'string' ? value : ''
}

/**
 * Replace a slide's notes. An empty string removes the field so a slide without notes stays
 * without them on export. Mutates the page node in place; the caller marks the document
 * modified (e.g. `requestRender()`), which is what makes the edit save and autosave.
 */
export function setSlideSpeakerNotes(page: SceneNode, notes: string): void {
  const fields = page.source.fig.rawNodeFields
  if (notes.length === 0) Reflect.deleteProperty(fields, SLIDE_SPEAKER_NOTES_FIELD)
  else fields[SLIDE_SPEAKER_NOTES_FIELD] = notes
}
