/**
 * References to things in OpenPencil, written in chat text as Markdown links with the
 * `openpencil:` scheme: `[Hero](openpencil://node/12:34)`. People insert them from the
 * composer and the model cites what it touched with them; the chat shows them as chips.
 */
export type ChatReferenceKind = 'node' | 'page' | 'skill'

export interface ChatReference {
  kind: ChatReferenceKind
  /** A node or page ID, or a skill's name. */
  id: string
  /** The name when the reference was written, shown when the target is gone. */
  label: string
}

export interface ChatReferenceMatch {
  reference: ChatReference
  start: number
  end: number
}

const SCHEME = 'openpencil://'
const KINDS: ReadonlySet<string> = new Set<ChatReferenceKind>(['node', 'page', 'skill'])

/** A link whose label holds no unescaped `]` or line break and whose URL has no space. */
const LINK = /\[((?:\\.|[^\]\\\n])*)\]\(openpencil:\/\/([a-z]+)\/([^)\s]+)\)/g

function isKind(kind: string): kind is ChatReferenceKind {
  return KINDS.has(kind)
}

function escapeLabel(label: string): string {
  return label.replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ')
}

function unescapeLabel(label: string): string {
  return label.replace(/\\(.)/g, '$1')
}

function decodeID(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

/** A reference from its parts as text carries them, or null for a kind the chat does not know. */
export function chatReference(kind: string, id: string, label: string): ChatReference | null {
  return isKind(kind) && id ? { kind, id, label } : null
}

export function referenceURL({ kind, id }: Pick<ChatReference, 'kind' | 'id'>): string {
  return `${SCHEME}${kind}/${encodeURIComponent(id)}`
}

export function referenceLink(reference: ChatReference): string {
  return `[${escapeLabel(reference.label)}](${referenceURL(reference)})`
}

/** The reference a link's URL names, or null when it names none. */
export function parseReferenceURL(url: string): Pick<ChatReference, 'kind' | 'id'> | null {
  if (!url.startsWith(SCHEME)) return null
  const [kind = '', encoded = '', ...rest] = url.slice(SCHEME.length).split('/')
  const id = rest.length === 0 ? decodeID(encoded) : null
  return isKind(kind) && id ? { kind, id } : null
}

/** Every reference link in the text, in order. */
export function findReferences(text: string): ChatReferenceMatch[] {
  const matches: ChatReferenceMatch[] = []
  for (const match of text.matchAll(LINK)) {
    const [source, label = '', kind = '', encoded = ''] = match
    const id = decodeID(encoded)
    if (!isKind(kind) || !id) continue
    matches.push({
      reference: { kind, id, label: unescapeLabel(label) },
      start: match.index,
      end: match.index + source.length
    })
  }
  return matches
}

/** The text with each reference reduced to its label, for places that show plain text. */
export function withReferenceLabels(text: string): string {
  let result = ''
  let at = 0
  for (const { reference, start, end } of findReferences(text)) {
    result += text.slice(at, start) + reference.label
    at = end
  }
  return result + text.slice(at)
}

function attribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * The Markdown the transcript renders: each reference link becomes an inline `chat-reference`
 * component, so other links keep the renderer's own handling and its safety prompt.
 */
export function referenceComponents(markdown: string): string {
  let result = ''
  let at = 0
  for (const { reference, start, end } of findReferences(markdown)) {
    result += markdown.slice(at, start)
    result += `:chat-reference[${escapeLabel(reference.label)}]{kind="${reference.kind}" target="${attribute(reference.id)}" label="${attribute(reference.label)}"}`
    at = end
  }
  return result + markdown.slice(at)
}
