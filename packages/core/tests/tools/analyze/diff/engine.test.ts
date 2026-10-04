import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { formatOperations, parseOperations } from '#core/tools/analyze/diff/format'
import { deltaOperations, type DiffOperation } from '#core/tools/analyze/diff/operations'
import {
  diffProjections,
  projectTree,
  type DiffMatch
} from '#core/tools/analyze/diff/projection'
import { expectDefined } from '#core-tests/helpers/assert'

/** Operations for what `edit` changes; a projection is plain data, so it snapshots the tree. */
function operations(graph: SceneGraph, rootId: string, match: DiffMatch, edit: () => void) {
  const from = expectDefined(projectTree(graph, rootId, { match }), 'before')
  edit()
  const to = expectDefined(projectTree(graph, rootId, { match }), 'after')
  return deltaOperations(diffProjections(from, to), from, to, () => '<Frame />')
}

function card() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const root = figma.createFrame()
  root.name = 'Card'
  for (const name of ['A', 'B', 'C']) {
    const child = figma.createRectangle()
    child.name = name
    root.appendChild(child)
  }
  return { graph, figma, root }
}

describe('diff engine', () => {
  test('matching by ID, a rename is an attribute change', () => {
    const { graph, root } = card()
    const child = expectDefined(root.children[0], 'child')

    expect(operations(graph, root.id, 'id', () => (child.name = 'Renamed'))).toEqual([
      { kind: 'update', path: '/Card/A', id: child.id, removed: ['name="A"'], added: ['name="Renamed"'] }
    ])
  })

  test('matching by path, a rename is a removal and an addition', () => {
    const { graph, root } = card()
    const child = expectDefined(root.children[0], 'child')
    const ops = operations(graph, root.id, 'path', () => (child.name = 'Renamed'))

    expect(ops.map((op) => op.kind).toSorted()).toEqual([
      'add',
      'remove'
    ])
  })

  test('a reordered child is one move, not a change to every sibling', () => {
    const { graph, root } = card()
    const last = expectDefined(root.children[2], 'last')

    expect(operations(graph, root.id, 'id', () => root.insertChild(0, last))).toEqual([
      { kind: 'move', path: '/Card/C', id: last.id, index: 0 }
    ])
  })

  test('repeated names match their counterparts in order', () => {
    const { graph, root } = card()
    for (const child of root.children) child.name = 'Item'
    const second = expectDefined(root.children[1], 'second')

    expect(operations(graph, root.id, 'path', () => (second.opacity = 0.5))).toEqual([
      { kind: 'update', path: '/Card/Item', id: second.id, removed: [], added: ['opacity={0.5}'] }
    ])
  })
})

describe('patch format', () => {
  test('parses what it prints', () => {
    const ops: DiffOperation[] = [
      { kind: 'update', path: '/Card', id: '1:2', removed: ['w={1}'], added: ['w={2}', 'clipsContent'] },
      { kind: 'move', path: '/Card/Badge', id: '1:3', index: 0 },
      // Names that look like header endings still parse, because headers anchor on the end.
      { kind: 'remove', path: '/Card/Old #9:9 removed', id: '1:4' },
      {
        kind: 'add',
        path: '/Card/Row',
        parentId: '1:2',
        index: 3,
        jsx: '<Frame name="Row">\n  <Text>Hi</Text>\n</Frame>'
      }
    ]
    expect(parseOperations(formatOperations(ops))).toEqual(ops)
  })
})
