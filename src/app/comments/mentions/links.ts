import { uniq } from 'es-toolkit'
import type { Link, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'
import { visit } from 'unist-util-visit'

import type { CommentPerson } from '@open-pencil/cloud/contract'

/**
 * Mentions in comment text, written as Markdown links to the person's account, as chat writes
 * its references (`@/app/ai/chat/references/link.ts`): `[@Ana](openpencil://person/<account>)`.
 * The composer shows `@Ana` while it is written, keeps where each one picked stands as the text
 * changes, and turns exactly those into links on send; links are read and written with mdast.
 */

/** Someone a comment may name: a person the document's server lists for it. */
export type MentionPerson = CommentPerson

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

/** Comment text as the renderer reads it: GFM, with bare URLs as links. */
function parse(text: string): Root {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

/** A mention picked while writing: where its `@Name` is in the text, and whom it names. */
export type PickedMention = { start: number; end: number; person: MentionPerson }

/**
 * The picked mentions after the text changed from `previous` to `next`: those before or after the
 * edit move with the text around them, and one the edit touched is no longer a mention.
 */
export function shiftMentions(
  previous: string,
  next: string,
  picked: readonly PickedMention[]
): PickedMention[] {
  let prefix = 0
  const shorter = Math.min(previous.length, next.length)
  while (prefix < shorter && previous[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shorter - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }
  const editEnd = previous.length - suffix
  const delta = next.length - previous.length
  return picked.flatMap((mention) => {
    if (mention.end <= prefix) return [mention]
    if (mention.start >= editEnd) {
      return [{ ...mention, start: mention.start + delta, end: mention.end + delta }]
    }
    return []
  })
}

/** The text as it is sent: each picked `@Name` replaced by the link to the person picked. */
export function linkMentions(text: string, picked: readonly PickedMention[]): string {
  let result = text
  for (const { start, end, person } of picked.toSorted((a, b) => b.start - a.start)) {
    if (text.slice(start, end) !== `@${person.name}`) continue
    result = result.slice(0, start) + mentionLink(person) + result.slice(end)
  }
  return result
}

/**
 * Text with `person` picked over the range `start`–`end`, and the mentions it then holds. A mention
 * the range overlaps gives way to the new one, so no two ever cover the same text.
 */
export function insertMention(
  text: string,
  range: { start: number; end: number },
  person: MentionPerson,
  picked: readonly PickedMention[]
): { text: string; picked: PickedMention[]; caret: number } {
  const { start, end } = range
  const name = `@${person.name}`
  const delta = name.length + 1 - (end - start)
  const kept = picked.flatMap((mention) => {
    if (mention.end <= start) return [mention]
    if (mention.start >= end) {
      return [{ ...mention, start: mention.start + delta, end: mention.end + delta }]
    }
    return []
  })
  return {
    text: `${text.slice(0, start)}${name} ${text.slice(end)}`,
    picked: [...kept, { start, end: start + name.length, person }],
    caret: start + name.length + 1
  }
}

/** The `@query` being typed right before the caret, if any. */
export function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const match = /(?:^|[\s([])@([^\s@[\]()]*)$/.exec(text.slice(0, caret))
  if (!match) return null
  const [, query] = match
  return { query, start: caret - query.length - 1 }
}
