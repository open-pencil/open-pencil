import { afterEach, expect, spyOn, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { DecodedMap } from '#fig/document/decoded-map'

import { createFigDocumentSession } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { guid } from '@open-pencil/test-support/fig/guid'

function deepFreeze(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return
  if (seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  Object.freeze(value)
}

let restore: (() => void) | undefined
afterEach(() => restore?.())

/**
 * Every record the reader keeps for the session, component definitions and styles, is frozen
 * as its interpreter reads it. Those records serve every copy built for the rest of the session,
 * on pages loaded later too, and a copy's payload and the layers built from it share their
 * values rather than copying them, so nothing may write into them.
 */
function freezeServedRecords(): () => number {
  const get = DecodedMap.prototype.get
  let served = 0
  const spy = spyOn(DecodedMap.prototype, 'get').mockImplementation(function (
    this: DecodedMap<unknown, unknown, unknown>,
    key: unknown
  ) {
    const value: unknown = get.call(this, key)
    if (value !== undefined) {
      served++
      deepFreeze(value)
    }
    return value
  })
  restore = () => spy.mockRestore()
  return () => served
}

const paint = (r: number): NonNullable<NodeChange['fillPaints']> => [
  { type: 'SOLID', color: { r, g: 1 - r, b: 0, a: 1 }, visible: true, opacity: 1 }
]

/** A card component nesting an icon, on one page, and overridden instances of it on another. */
const records: NodeChange[] = [
  { guid: guid(0), type: 'DOCUMENT' },
  { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
  { guid: guid(7), type: 'CANVAS', parentIndex: { guid: guid(0), position: '"' } },
  { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
  {
    guid: guid(3),
    type: 'ROUNDED_RECTANGLE',
    parentIndex: { guid: guid(2), position: '!' },
    fillPaints: paint(1)
  },
  {
    guid: guid(4),
    type: 'SYMBOL',
    parentIndex: { guid: guid(1), position: '"' },
    fillPaints: paint(0)
  },
  {
    guid: guid(5),
    type: 'TEXT',
    parentIndex: { guid: guid(4), position: '!' },
    textData: { characters: 'Title' }
  },
  {
    guid: guid(6),
    type: 'INSTANCE',
    parentIndex: { guid: guid(4), position: '"' },
    symbolData: { symbolID: guid(2) }
  },
  {
    guid: guid(8),
    type: 'INSTANCE',
    parentIndex: { guid: guid(7), position: '!' },
    symbolData: {
      symbolID: guid(4),
      symbolOverrides: [{ guidPath: { guids: [guid(5)] }, textData: { characters: 'Custom' } }]
    }
  },
  {
    guid: guid(9),
    type: 'INSTANCE',
    parentIndex: { guid: guid(7), position: '"' },
    symbolData: { symbolID: guid(4) },
    fillPaints: paint(0.5)
  }
] as NodeChange[]

/** Edits that reach the layers inside instances, as the editor makes them. */
function editInstanceLayers(graph: SceneGraph): void {
  for (const instance of [...graph.getAllNodes()].filter((node) => node.type === 'INSTANCE')) {
    graph.syncInstance(instance.id)
    for (const layer of graph.getChildren(instance.id) as SceneNode[]) {
      graph.updateNode(layer.id, { opacity: 0.5, name: `${layer.name} edited` })
      if (layer.type === 'TEXT') graph.updateNode(layer.id, { text: 'Edited' })
    }
  }
}

test('a recovered session builds and edits copies of kept records without writing into one', async () => {
  const bytes = await figArchiveOf(records)
  const initial = createFigDocumentSession(bytes)
  initial.loadPage('1:7')
  const served = freezeServedRecords()
  // Recovery reads every component the first session built from the reader's kept records.
  const recovered = createFigDocumentSession(
    bytes,
    {},
    { graph: initial.graph, checkpoint: initial.checkpoint() }
  )
  for (const page of recovered.pages) recovered.loadPage(page.id)
  editInstanceLayers(recovered.graph)
  expect(served()).toBeGreaterThan(0)
})
