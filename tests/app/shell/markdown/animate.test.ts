import { describe, expect, test } from 'bun:test'

import type { Node } from 'comark'

import { animateWords, parsedElement, STREAMING_WORD_CLASS } from '@/app/shell/markdown/animate'

const word = (text: string): Node => ['span', { class: STREAMING_WORD_CLASS }, text]

describe('words that fade in as a reply streams', () => {
  test('each word of the text is its own element, and the spaces stay text', () => {
    expect(animateWords([['p', {}, 'Hello  there ', ['strong', {}, 'bold move']]])).toEqual([
      [
        'p',
        {},
        word('Hello'),
        '  ',
        word('there'),
        ' ',
        ['strong', {}, word('bold'), ' ', word('move')]
      ]
    ])
  })

  test('code keeps its text whole', () => {
    const code: Node[] = [
      ['p', {}, ['code', {}, 'const a']],
      ['pre', { language: 'ts' }, ['code', {}, 'const b = 1']]
    ]
    expect(animateWords(code)).toEqual(code)
  })

  test('a word already shown keeps its place as more text arrives', () => {
    const before = animateWords([['p', {}, 'The card is']])
    const after = animateWords([['p', {}, 'The card is ready']])
    expect(after[0]?.slice(0, -2)).toEqual(before[0])
  })

  test('an element rendered word by word still gives back the element as parsed', () => {
    const table: Node = ['table', {}, ['tbody', {}, ['tr', {}, ['td', {}, 'Two words']]]]
    const [animated] = animateWords([table])
    expect(animated).not.toEqual(table)
    if (typeof animated !== 'object' || animated[0] === null) throw new Error('expected an element')
    expect(parsedElement(animated)).toBe(table)
  })
})
