import { groupBy, uniq, uniqBy } from 'es-toolkit'
import type { Link, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'
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
  visit(parse(text), 'link', (link: Link) => {
    const id = mentionedAccount(link.url)
    if (id) ids.push(id)
  })
  return uniq(ids)
}

/** Comment text as the renderer reads it: GFM, so a bare URL is a link, not text with `@` in it. */
function parse(text: string): Root {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

/**
 * Where the plain text of the Markdown is written, outside links and code: each text node's
 * span of the source, escapes and all, so a name is found where it was typed.
 */
function textSpans(root: Root): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = []
  visit(root, (node) => {
    if (node.type === 'link' || node.type === 'linkReference') return SKIP
    const start = node.type === 'text' ? node.position?.start.offset : undefined
    const end = node.type === 'text' ? node.position?.end.offset : undefined
    if (start !== undefined && end !== undefined) spans.push({ start, end })
    return undefined
  })
  return spans
}

/**
 * The text as it is sent: each `@Name` of someone picked while writing becomes their link, in the
 * plain text only, never inside code, a URL or another link. A whole name only, so `@Ana` is not
 * taken from `@Anabel`, and longer names first, so `@Ana Lee` is not taken for `@Ana`. Two
 * people of one name are told apart by the order they were picked in.
 */
export function withMentionLinks(text: string, picked: readonly MentionPerson[]): string {
  if (picked.length === 0) return text
  const byName = groupBy(picked, (person) => person.name)
  const names = Object.keys(byName).toSorted((a, b) => b.length - a.length)
  const spans = textSpans(parse(text))
  const replacements: { start: number; end: number; link: string }[] = []
  for (const name of names) {
    const typed = `@${name}`
    const people = uniqBy(byName[name] ?? [], (person) => person.id)
    let found = 0
    for (const span of spans) {
      const source = text.slice(span.start, span.end)
      for (let at = source.indexOf(typed); at >= 0; at = source.indexOf(typed, at + 1)) {
        const start = span.start + at
        const end = start + typed.length
        const whole = !/[\p{L}\p{N}_]/u.test(text.slice(end, end + 1))
        const escaped = text.slice(start - 1, start) === '\\'
        const taken = replacements.some((other) => start < other.end && end > other.start)
        if (!whole || escaped || taken) continue
        const person = people.at(Math.min(found, people.length - 1))
        found++
        if (person) replacements.push({ start, end, link: mentionLink(person) })
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
