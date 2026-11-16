import { describe, expect, test } from 'bun:test'

import {
  insertMention,
  linkMentions,
  mentionedAccounts,
  mentionLink,
  mentionQuery,
  shiftMentions,
  type PickedMention
} from '@/app/comments/mentions/links'

const ana = { id: 'acc-ana', name: 'Ana', image: null }
const sam = { id: 'acc-sam', name: 'Sam', image: null }
const otherSam = { id: 'acc-sam-2', name: 'Sam', image: null }

/** The mention of `person` where its `@Name` first stands in `text` from `from` on. */
function at(text: string, person: typeof ana, from = 0): PickedMention {
  const start = text.indexOf(`@${person.name}`, from)
  return { start, end: start + person.name.length + 1, person }
}

describe('comment mentions', () => {
  test('send exactly the mentions picked, each as a link to the one picked', () => {
    const text = '@Sam and @Sam, not @Ana'
    const picked = [at(text, sam), at(text, otherSam, 5)]
    expect(linkMentions(text, picked)).toBe(
      '[@Sam](openpencil://person/acc-sam) and [@Sam](openpencil://person/acc-sam-2), not @Ana'
    )
  })

  test('keep each mention on its person as the text around it changes', () => {
    const before = '@Sam and @Sam'
    const picked = [at(before, sam), at(before, otherSam, 5)]
    // The first mention is deleted; the second stays the second Sam.
    const after = ' and @Sam'
    const kept = shiftMentions(before, after, picked)
    expect(kept).toEqual([{ start: 5, end: 9, person: otherSam }])
    expect(mentionedAccounts(linkMentions(after, kept))).toEqual(['acc-sam-2'])
    // Typing before a mention moves it; typing inside one ends it.
    expect(shiftMentions(after, `Hi${after}`, kept)).toEqual([
      { start: 7, end: 11, person: otherSam }
    ])
    expect(shiftMentions(after, ' and @Sxam', kept)).toEqual([])
  })

  test('pick a person over a mention already there, never as a second one', () => {
    const first = insertMention('@An', { start: 0, end: 3 }, ana, [])
    expect(first).toEqual({ text: '@Ana ', picked: [at('@Ana ', ana)], caret: 5 })
    // Picked again with the caret at the end of the name, before the space.
    const again = insertMention(first.text, { start: 0, end: 4 }, sam, first.picked)
    expect(again.picked).toEqual([at(again.text, sam)])
    expect(linkMentions(again.text, again.picked)).toBe('[@Sam](openpencil://person/acc-sam)  ')
  })

  test('move the mentions after the one picked', () => {
    const text = 'hi @ and @Ana'
    const next = insertMention(text, { start: 3, end: 4 }, sam, [at(text, ana)])
    expect(next.text).toBe('hi @Sam  and @Ana')
    expect(next.picked).toEqual([at(next.text, ana), at(next.text, sam)])
  })

  test('escape a name as Markdown writes a link’s text', () => {
    const odd = { id: 'acc-odd', name: 'Ann [ops] *', image: null }
    expect(mentionLink(odd)).toBe('[@Ann \\[ops\\] *](openpencil://person/acc-odd)')
    expect(
      mentionedAccounts(linkMentions('hi @Ann [ops] *', [at('hi @Ann [ops] *', odd)]))
    ).toEqual(['acc-odd'])
  })

  test('name each account a comment links to once, and nothing else', () => {
    const text = `${mentionLink(ana)} ${mentionLink(sam)} ${mentionLink(ana)}`
    expect(mentionedAccounts(text)).toEqual(['acc-ana', 'acc-sam'])
    expect(mentionedAccounts('[@Ana](https://example.com) `[@x](openpencil://person/y)`')).toEqual(
      []
    )
  })

  test('find the name being typed after an @', () => {
    expect(mentionQuery('Hi @An', 6)).toEqual({ query: 'An', start: 3 })
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 })
    expect(mentionQuery('mail@example', 12)).toBeNull()
    expect(mentionQuery('@Ana done', 9)).toBeNull()
  })
})
