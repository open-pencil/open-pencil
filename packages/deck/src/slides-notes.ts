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
  return typeof value === 'string' ? speakerNotesPlainText(value) : ''
}

/**
 * A note as a person can read it.
 *
 * Figma writes speaker notes as a serialised Lexical editor state, not as text:
 * a slide whose note reads "OpenPencil is a free design tool" arrives as
 * `{"root":{"children":[{"children":[{"text":"OpenPencil is …"}]}]}}`. Handing
 * that to the notes pane rendered the JSON verbatim, so every imported deck
 * showed its own serialisation format where the speaker's words should be.
 *
 * Notes typed in OpenPencil are stored as plain strings, so anything that is
 * not a Lexical payload passes through untouched — the check is the shape of
 * the value, never where the deck came from.
 */
export function speakerNotesPlainText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return value

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // A note that merely begins with a brace is still a note.
    return value
  }

  const root = readChild(parsed, 'root')
  if (root === null) return value
  const blocks = collectBlocks(root)
  // A Lexical state with no text at all is an empty note, not a reason to fall
  // back to showing the user their own JSON.
  return blocks.join('\n\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readChild(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  const child = value[key]
  if (!isRecord(child)) return null
  return child
}

/** Top-level children become paragraphs; everything below them is inline text. */
function collectBlocks(root: Record<string, unknown>): string[] {
  const children = root['children']
  if (!Array.isArray(children)) return []
  const blocks: string[] = []
  for (const child of children) {
    const text = collectText(child).trim()
    if (text.length > 0) blocks.push(text)
  }
  return blocks
}

function collectText(node: unknown): string {
  if (!isRecord(node)) return ''
  const record = node
  // A linebreak node carries no text and must not silently join two words.
  if (record['type'] === 'linebreak') return '\n'
  const own = typeof record['text'] === 'string' ? record['text'] : ''
  const children = record['children']
  if (!Array.isArray(children)) return own
  return own + children.map((child) => collectText(child)).join('')
}

/**
 * Replace a slide's notes. An empty string removes the field so a slide without notes stays
 * without them on export. Mutates the page node in place; the caller marks the document
 * modified (e.g. `requestRender()`), which is what makes the edit save and autosave.
 */
export function setSlideSpeakerNotes(page: SceneNode, notes: string): void {
  const fields = page.source.fig.rawNodeFields
  if (notes.length === 0) Reflect.deleteProperty(fields, SLIDE_SPEAKER_NOTES_FIELD)
  else fields[SLIDE_SPEAKER_NOTES_FIELD] = speakerNotesLexical(notes)
}

/**
 * Text as the editor state the field is defined to hold.
 *
 * Notes are read back through `speakerNotesPlainText`, so a plain string would
 * survive a round trip inside OpenPencil and still be wrong: the field carries
 * a serialised Lexical document, and writing bare text into it hands the
 * exporting application something it cannot parse. Editing an imported note
 * previously did exactly that, replacing a valid editor state with a fragment
 * only this app could read.
 *
 * Inline formatting inside a note is not preserved — the notes pane is a
 * plain-text control, so there is none to preserve. What this keeps is the
 * document shape, which is what makes the note survive the deck round trip.
 */
export function speakerNotesLexical(text: string): string {
  const paragraphs = text.split(/\n{2,}/)
  return JSON.stringify({
    root: {
      children: paragraphs.map((paragraph) => ({
        children: lexicalInlineChildren(paragraph),
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: ''
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  })
}

/** Single newlines are line breaks within one paragraph, as Lexical models them. */
function lexicalInlineChildren(paragraph: string): Record<string, unknown>[] {
  const lines = paragraph.split('\n')
  const children: Record<string, unknown>[] = []
  for (const [index, line] of lines.entries()) {
    if (index > 0) children.push({ type: 'linebreak', version: 1 })
    if (line.length === 0) continue
    children.push({
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text: line,
      type: 'text',
      version: 1
    })
  }
  return children
}
