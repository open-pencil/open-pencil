import { uniq } from 'es-toolkit'
import type { Link, Root, Text } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'
import { SKIP, visit } from 'unist-util-visit'

/**
 * Mentions in comment text, written as Markdown links to the person's account, as chat writes
 * its references (`@/app/ai/chat/references/link.ts`): `[@Ana](openpencil://person/<account>)`.
 * The composer shows `@Ana` while it is written and turns the people picked into links on send;
 * the text is read and written with mdast, so its own Markdown is never misread.
 */

/** Someone a comment may name. */
export type MentionPerson = { id: string; name: string }

const PERSON = 'openpencil://person/'
/** What an account ID may hold, so it stands in a URL as it is. */
const ACCOUNT_ID = /^[\w-]+$/

/** The account a link names, or null for any other link. */
export function mentionedAccount(url: string): string | null {
  if (!url.startsWith(PERSON)) return null
  const id = url.slice(PERSON.length)
  return ACCOUNT_ID.test(id) ? id : null
}

/** The Markdown link naming `person`, escaped as Markdown writes a link. */
export function mentionLink(person: MentionPerson): string {
  const link: Link = {
    type: 'link',
    url: `${PERSON}${person.id}`,
    children: [{ type: 'text', value: `@${person.name}` }]
  }
  return toMarkdown(link).trimEnd()
}

/** The accounts the text names, each once, in order. */
export function mentionedAccounts(text: string): string[] {
  const ids: string[] = []
  visit(fromMarkdown(text), 'link', (link: Link) => {
    const id = mentionedAccount(link.url)
    if (id) ids.push(id)
  })
  return uniq(ids)
}

/** The plain text runs of the Markdown, outside links and code, with where each is written. */
function textRuns(root: Root, source: string): { start: number; value: string }[] {
  const runs: { start: number; value: string }[] = []
  visit(root, (node) => {
    if (node.type === 'link' || node.type === 'linkReference') return SKIP
    if (node.type !== 'text') return undefined
    const { value, position } = node satisfies Text
    const start = position?.start.offset
    const end = position?.end.offset
    // A run with escapes in it is written differently from what it says; it is left as typed.
    if (start !== undefined && source.slice(start, end) === value) runs.push({ start, value })
    return undefined
  })
  return runs
}

/**
 * The text as it is sent: each `@Name` of someone picked while writing becomes their link, in the
 * plain text only, never inside code or another link. A whole name only, so `@Ana` is not taken
 * from `@Anabel`; longer names first, so `@Ana Lee` is not taken for `@Ana`.
 */
export function withMentionLinks(text: string, picked: readonly MentionPerson[]): string {
  const people = uniq(picked.map((person) => person.id))
    .flatMap((id) => picked.find((person) => person.id === id) ?? [])
    .toSorted((a, b) => b.name.length - a.name.length)
  if (people.length === 0) return text
  const replacements: { start: number; end: number; link: string }[] = []
  for (const run of textRuns(fromMarkdown(text), text)) {
    for (const person of people) {
      const typed = `@${person.name}`
      for (let at = run.value.indexOf(typed); at >= 0; at = run.value.indexOf(typed, at + 1)) {
        const start = run.start + at
        const end = start + typed.length
        const next = text.slice(end, end + 1)
        const taken = replacements.some((other) => start < other.end && end > other.start)
        if (taken || /[\p{L}\p{N}_]/u.test(next)) continue
        replacements.push({ start, end, link: mentionLink(person) })
      }
    }
  }
  let result = text
  for (const { start, end, link } of replacements.toSorted((a, b) => b.start - a.start)) {
    result = result.slice(0, start) + link + result.slice(end)
  }
  return result
}

/** The `@query` being typed right before the caret, if any. */
export function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const match = /(?:^|[\s([])@([^\s@[\]()]*)$/.exec(text.slice(0, caret))
  if (!match) return null
  const [, query] = match
  return { query, start: caret - query.length - 1 }
}
