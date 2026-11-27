import { partition } from 'es-toolkit/array'
import * as v from 'valibot'

/** The parts of Figma's Lexical notes that hold their text. */
interface NotesNode {
  type?: string
  text?: string
  children?: NotesNode[]
}
const notesNodeSchema: v.GenericSchema<NotesNode> = v.looseObject({
  type: v.optional(v.string()),
  text: v.optional(v.string()),
  children: v.optional(v.array(v.lazy(() => notesNodeSchema)))
})
const notesSchema = v.pipe(v.string(), v.parseJson(), v.object({ root: notesNodeSchema }))

function notesText(node: NotesNode): string {
  if (node.type === 'linebreak') return '\n'
  return node.text ?? (node.children ?? []).map(notesText).join('')
}

/** Notes as plain text, a line for each block; a list's items, nested ones too, are blocks. */
function notesLines(node: NotesNode): string[] {
  return (node.children ?? []).flatMap((child) => {
    if (child.type === 'list') return notesLines(child)
    const [lists, inline] = partition(child.children ?? [], ({ type }) => type === 'list')
    if (lists.length === 0) return [notesText(child)]
    const text = inline.map(notesText).join('')
    return [...(text ? [text] : []), ...lists.flatMap(notesLines)]
  })
}

export function extractNotes(value: unknown): string {
  const parsed = v.safeParse(notesSchema, value)
  return parsed.success ? notesLines(parsed.output.root).join('\n') : ''
}

/** The record Figma's notes editor writes for plain paragraphs. */
export function notesRecord(notes: string): string {
  const block = { direction: null, format: '', indent: 0, version: 1 }
  const paragraphs = notes.split('\n').map((text) => ({
    children: text
      ? [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }]
      : [],
    ...block,
    type: 'paragraph',
    textFormat: 0,
    textStyle: ''
  }))
  return JSON.stringify({ root: { children: paragraphs, ...block, type: 'root' } })
}
