import { describe, expect, test } from 'bun:test'

import {
  findReferences,
  parseReferenceURL,
  referenceComponents,
  referenceLink,
  withReferenceLabels
} from '@/app/ai/chat/references/link'

describe('chat references', () => {
  test('a link round-trips its kind, ID, and label', () => {
    const link = referenceLink({ kind: 'node', id: '12:34', label: 'Hero [main]' })
    expect(link).toBe('[Hero \\[main\\]](openpencil://node/12%3A34)')
    expect(findReferences(`See ${link}.`)).toEqual([
      {
        reference: { kind: 'node', id: '12:34', label: 'Hero [main]' },
        start: 4,
        end: 4 + link.length
      }
    ])
  })

  test('reads what a model writes by hand, and nothing that is not a reference', () => {
    expect(
      findReferences('[Card](openpencil://node/1:2) and [Home](openpencil://page/0:1)').map(
        ({ reference }) => reference
      )
    ).toEqual([
      { kind: 'node', id: '1:2', label: 'Card' },
      { kind: 'page', id: '0:1', label: 'Home' }
    ])
    expect(findReferences('[site](https://example.com) [x](openpencil://file/1)')).toEqual([])
    expect(parseReferenceURL('openpencil://skill/brand-review')).toEqual({
      kind: 'skill',
      id: 'brand-review'
    })
    expect(parseReferenceURL('openpencil://node/1/2')).toBeNull()
  })

  test('the transcript renders references as components and leaves other links alone', () => {
    expect(
      referenceComponents('Moved [Card "A"](openpencil://node/1:2) per [docs](https://x.dev).')
    ).toBe(
      'Moved :chat-reference[Card "A"]{kind="node" target="1:2" label="Card &quot;A&quot;"} per [docs](https://x.dev).'
    )
  })

  test('plain text keeps only the labels', () => {
    expect(withReferenceLabels('Make [Hero](openpencil://node/1:2) wider')).toBe('Make Hero wider')
  })
})
