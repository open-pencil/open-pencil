import { findReferences, referenceLink } from './link'

/**
 * Commands chosen from `/`, such as `/compact` or `/skill:grid`: a reference of the `command`
 * kind, so the composer shows a chip and the chat reads the command from the link, never by
 * matching what was typed.
 */
export function commandLink(name: string): string {
  return referenceLink({ kind: 'command', id: name, label: `/${name}` })
}

export interface LeadingCommand {
  name: string
  /** What follows the command, such as what a summary should keep. */
  rest: string
}

/** The command a message starts with, and the text after it; null when it starts with none. */
export function leadingCommand(text: string): LeadingCommand | null {
  const first = findReferences(text).at(0)
  if (first?.reference.kind !== 'command' || text.slice(0, first.start).trim()) return null
  return { name: first.reference.id, rest: text.slice(first.end).trim() }
}

/**
 * The text with each command written out as typed, for whoever reads the message: agents
 * and Pi run their own commands from the text, and a model reads `/skill:grid` as written.
 */
export function commandsAsText(text: string): string {
  let result = ''
  let at = 0
  for (const { reference, start, end } of findReferences(text)) {
    if (reference.kind !== 'command') continue
    result += text.slice(at, start) + reference.label
    at = end
  }
  return result + text.slice(at)
}
