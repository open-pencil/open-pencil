import { describe, expect, test } from 'bun:test'

import {
  commentFormatForKey,
  commentPreview,
  continueList,
  formatComment,
  type CommentEdit
} from '@/app/comments/format'

/** `[` and `]` mark the selection, `|` a caret. */
function edit(marked: string): CommentEdit {
  const caret = marked.indexOf('|')
  if (caret !== -1) return { value: marked.replace('|', ''), start: caret, end: caret }
  const start = marked.indexOf('[')
  const end = marked.indexOf(']') - 1
  return { value: marked.replace('[', '').replace(']', ''), start, end }
}

function show({ value, start, end }: CommentEdit): string {
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`
}

function continued(marked: string): string {
  const next = continueList(edit(marked))
  if (!next) throw new Error(`Not a list item: ${marked}`)
  return show(next)
}

describe('comment formatting', () => {
  test('maps Figma’s shortcuts', () => {
    const key = (code: string, shiftKey = false) =>
      commentFormatForKey({ code, shiftKey, altKey: false, mod: true })
    expect([key('KeyB'), key('KeyI'), key('KeyK')]).toEqual(['bold', 'italic', 'link'])
    expect([key('KeyX', true), key('Digit7', true), key('Digit8', true)]).toEqual([
      'strikethrough',
      'numbered',
      'bulleted'
    ])
    expect(commentFormatForKey({ code: 'KeyB', shiftKey: false, altKey: false, mod: false })).toBe(
      null
    )
  })

  test('wraps the selection and unwraps it again', () => {
    const bold = formatComment(edit('make [this] bold'), 'bold')
    expect(show(bold)).toBe('make **[this]** bold')
    expect(show(formatComment(bold, 'bold'))).toBe('make [this] bold')
    expect(show(formatComment(edit('a |b'), 'italic'))).toBe('a *|*b')
    expect(show(formatComment(edit('[gone]'), 'strikethrough'))).toBe('~~[gone]~~')
  })

  test('turns the selection into a link with its address selected', () => {
    expect(show(formatComment(edit('see [docs] here'), 'link'))).toBe('see [docs]([url]) here')
    expect(show(formatComment(edit('see |'), 'link'))).toBe('see <[url]>')
  })

  test('starts, switches and ends lists over the selected lines', () => {
    const bulleted = formatComment(edit('[one\ntwo]'), 'bulleted')
    expect(show(bulleted)).toBe('[- one\n- two]')
    expect(show(formatComment(bulleted, 'numbered'))).toBe('[1. one\n2. two]')
    expect(show(formatComment(bulleted, 'bulleted'))).toBe('[one\ntwo]')
    expect(show(formatComment(edit('intro\nite|m'), 'bulleted'))).toBe('intro\n- ite|m')
  })

  test('Shift+Enter continues a list and ends it on an empty item', () => {
    expect(continued('- one|')).toBe('- one\n- |')
    expect(continued('1. one|')).toBe('1. one\n2. |')
    expect(continued('- one\n- |')).toBe('- one\n|')
    expect(continueList(edit('plain|'))).toBeNull()
  })

  test('previews a comment as one line of plain text', () => {
    expect(
      commentPreview('Make **this** *bigger*, see [docs](https://x.dev)\n- one\n- ~~two~~')
    ).toBe('Make this bigger, see docs one two')
  })
})
