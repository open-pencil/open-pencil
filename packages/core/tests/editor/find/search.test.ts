import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { countMatches, findInDocument, textMatchRanges } from '#core/editor/find'

const INSENSITIVE = { matchCase: false, wholeWord: false }
const WHOLE_WORD = { matchCase: false, wholeWord: true }

describe('textMatchRanges', () => {
  test('finds every occurrence, ignoring case unless asked', () => {
    expect(textMatchRanges('Pencil pencil PENCIL', 'pencil', INSENSITIVE)).toEqual([
      { start: 0, end: 6 },
      { start: 7, end: 13 },
      { start: 14, end: 20 }
    ])
    expect(
      textMatchRanges('Pencil pencil', 'pencil', { matchCase: true, wholeWord: false })
    ).toEqual([{ start: 7, end: 13 }])
  })

  test('the query is literal text, never a pattern', () => {
    expect(textMatchRanges('a.c abc a+c', 'a.c', INSENSITIVE)).toEqual([{ start: 0, end: 3 }])
    expect(textMatchRanges('2 (x) 3', '(x)', INSENSITIVE)).toEqual([{ start: 2, end: 5 }])
    expect(textMatchRanges('price $5', '$5', INSENSITIVE)).toEqual([{ start: 6, end: 8 }])
  })

  test('whole word skips matches inside longer words, accented letters included', () => {
    expect(textMatchRanges('cat cats concat café cat.', 'cat', WHOLE_WORD)).toEqual([
      { start: 0, end: 3 },
      { start: 21, end: 24 }
    ])
    expect(textMatchRanges('été', 'te', WHOLE_WORD)).toEqual([])
    expect(textMatchRanges('snake_case', 'snake', WHOLE_WORD)).toEqual([])
  })

  test('whole word also matches a query that is itself punctuation', () => {
    expect(textMatchRanges('a (b) c', '(b)', WHOLE_WORD)).toEqual([{ start: 2, end: 5 }])
  })

  test('an empty query or text matches nothing', () => {
    expect(textMatchRanges('abc', '', INSENSITIVE)).toEqual([])
    expect(textMatchRanges('', 'a', INSENSITIVE)).toEqual([])
  })
})

function scene() {
  const graph = new SceneGraph()
  const [first] = graph.getPages()
  const second = graph.addPage('Second')
  const frame = graph.createNode('FRAME', first.id, { name: 'Card' })
  const title = graph.createNode('TEXT', frame.id, { name: 'Title', text: 'Hello Pencil' })
  const body = graph.createNode('TEXT', frame.id, { name: 'Body', text: 'pencil and PENCIL' })
  graph.createNode('TEXT', frame.id, { name: 'Hidden', text: 'Pencil hidden', visible: false })
  const locked = graph.createNode('TEXT', frame.id, {
    name: 'Locked',
    text: 'Pencil locked',
    locked: true
  })
  const lockedFrame = graph.createNode('FRAME', first.id, { name: 'Frame', locked: true })
  const inLockedFrame = graph.createNode('TEXT', lockedFrame.id, {
    name: 'Inside',
    text: 'Pencil inside'
  })
  const other = graph.createNode('TEXT', second.id, { name: 'Other', text: 'Pencil elsewhere' })
  return { graph, first, second, title, body, locked, inLockedFrame, other }
}

describe('findInDocument', () => {
  test('the page scope reads one page in layer panel order and skips hidden layers', () => {
    const { graph, first, title, body, locked, inLockedFrame } = scene()
    const hits = findInDocument(graph, 'pencil', INSENSITIVE, { scope: 'page', pageId: first.id })
    expect(hits.map((hit) => hit.nodeId)).toEqual([title.id, body.id, locked.id, inLockedFrame.id])
    expect(countMatches(hits)).toBe(5)
  })

  test('the document scope reads every page', () => {
    const { graph, first, second, other } = scene()
    const hits = findInDocument(graph, 'pencil', INSENSITIVE, {
      scope: 'document',
      pageId: first.id
    })
    expect(hits).toHaveLength(5)
    expect(hits.at(-1)).toMatchObject({ nodeId: other.id, pageId: second.id })
  })

  test('a layer is locked itself or through a locked ancestor', () => {
    const { graph, first, title, locked, inLockedFrame } = scene()
    const hits = findInDocument(graph, 'pencil', INSENSITIVE, { scope: 'page', pageId: first.id })
    const lockedById = Object.fromEntries(hits.map((hit) => [hit.nodeId, hit.locked]))
    expect(lockedById).toMatchObject({
      [title.id]: false,
      [locked.id]: true,
      [inLockedFrame.id]: true
    })
  })

  test('match case and whole word narrow the hits', () => {
    const { graph, first, body } = scene()
    const context = { scope: 'page' as const, pageId: first.id }
    expect(
      findInDocument(graph, 'PENCIL', { matchCase: true, wholeWord: false }, context).map(
        (hit) => hit.ranges
      )
    ).toEqual([[{ start: 11, end: 17 }]])
    expect(findInDocument(graph, 'pen', WHOLE_WORD, context)).toEqual([])
    expect(findInDocument(graph, 'and', WHOLE_WORD, context)).toMatchObject([{ nodeId: body.id }])
  })

  test('an empty query finds nothing', () => {
    const { graph, first } = scene()
    expect(findInDocument(graph, '', INSENSITIVE, { scope: 'page', pageId: first.id })).toEqual([])
  })
})
