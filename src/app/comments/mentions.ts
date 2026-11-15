import { uniq } from 'es-toolkit'

import {
  componentAttribute,
  decodeLinkTarget,
  escapeLinkLabel,
  unescapeLinkLabel
} from '@/app/shell/markdown/links'

/**
 * Mentions in comment text, written as Markdown links to the person's account, as chat writes
 * its references (`@/app/ai/chat/references/link.ts`): `[@Ana](openpencil://person/<account>)`.
 * The composer shows `@Ana` while it is written and turns the people picked into links on send.
 */

/** Someone a comment may name. */
export type MentionPerson = { id: string; name: string }

const SCHEME = 'openpencil://person/'
/** A link whose label holds no unescaped `]` or line break and whose URL has no space. */
const MENTION = /\[((?:\\.|[^\]\\\n])*)\]\(openpencil:\/\/person\/([^)\s]+)\)/g

type MentionMatch = { id: string; label: string; start: number; end: number }

function findMentions(text: string): MentionMatch[] {
  const matches: MentionMatch[] = []
  for (const match of text.matchAll(MENTION)) {
    const [source, label = '', encoded = ''] = match
    const id = decodeLinkTarget(encoded)
    if (!id) continue
    matches.push({
      id,
      label: unescapeLinkLabel(label),
      start: match.index,
      end: match.index + source.length
    })
  }
  return matches
}

export function mentionLink(person: MentionPerson): string {
  return `[${escapeLinkLabel(`@${person.name}`)}](${SCHEME}${encodeURIComponent(person.id)})`
}

/** The accounts the text names, each once, in order. */
export function mentionedAccounts(text: string): string[] {
  return uniq(findMentions(text).map((mention) => mention.id))
}

/**
 * The text as it is sent: each `@Name` of someone picked while writing becomes their link. A
 * name the writer typed over, or never picked, stays as it was typed.
 */
export function withMentionLinks(text: string, picked: readonly MentionPerson[]): string {
  // Longer names first, so `@Ana Lee` is not taken for `@Ana`.
  const people = uniq(picked.map((person) => person.id))
    .flatMap((id) => picked.find((person) => person.id === id) ?? [])
    .toSorted((a, b) => b.name.length - a.name.length)
  let result = text
  for (const person of people) {
    const typed = `@${person.name}`
    let from = 0
    let next = ''
    for (let at = result.indexOf(typed); at >= 0; at = result.indexOf(typed, from)) {
      const after = result.slice(at + typed.length, at + typed.length + 1)
      const before = result.slice(Math.max(at - 1, 0), at)
      // A whole name only, and never one already inside a link.
      const whole = !/[\p{L}\p{N}_]/u.test(after) && before !== '['
      next += result.slice(from, at) + (whole ? mentionLink(person) : typed)
      from = at + typed.length
    }
    result = next + result.slice(from)
  }
  return result
}

/**
 * The Markdown a comment renders: each mention becomes an inline `comment-mention` component,
 * so other links keep the renderer's own handling and its safety prompt.
 */
export function mentionComponents(markdown: string): string {
  let result = ''
  let at = 0
  for (const { id, label, start, end } of findMentions(markdown)) {
    result += markdown.slice(at, start)
    result += `:comment-mention[${escapeLinkLabel(label)}]{target="${componentAttribute(id)}" label="${componentAttribute(label)}"}`
    at = end
  }
  return result + markdown.slice(at)
}

/** The `@query` being typed right before the caret, if any. */
export function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const match = /(?:^|[\s([])@([^\s@[\]()]*)$/.exec(text.slice(0, caret))
  if (!match) return null
  const [, query] = match
  return { query, start: caret - query.length - 1 }
}
