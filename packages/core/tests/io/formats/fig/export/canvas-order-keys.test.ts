import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

function positionsByParent(nodeChanges: readonly { parentIndex?: unknown }[]) {
  const byParent = new Map<string, string[]>()
  for (const change of nodeChanges) {
    const parentIndex = change.parentIndex as { guid?: GUID; position?: string } | undefined
    const parent = parentIndex?.guid
    if (!parent || parentIndex?.position === undefined) continue
    const key = `${parent.sessionID}:${parent.localID}`
    byParent.set(key, [...(byParent.get(key) ?? []), parentIndex.position])
  }
  return byParent
}

/**
 * Figma orders siblings by `parentIndex.position`. A canvas's own layers, its shared styles
 * and the variable records are written in three separate passes, and an internal canvas
 * receives all three, so each has to continue the keys the others already wrote.
 */
test('every child of a canvas is exported with its own order key', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  for (const name of ['One', 'Two', 'Three']) graph.createNode('FRAME', page.id, { name })

  // An internal canvas carrying ordinary layers, so its own pass meets the appended ones.
  const internal = graph.addPage('Internal resources')
  graph.updateNode(internal.id, { internalOnly: true })
  for (const name of ['Cached A', 'Cached B']) graph.createNode('FRAME', internal.id, { name })
  graph.createNode('TEXT', internal.id, {
    name: 'Shared typography',
    sharedStyleType: 'TEXT',
    text: 'Ag'
  })

  // Two collections, so the variable pass spans more than one group of records.
  for (const [collectionName, variableName] of [
    ['Tokens', 'Accent'],
    ['Spacing', 'Gutter']
  ]) {
    const collection = graph.createCollection(collectionName)
    graph.createVariable(variableName, 'FLOAT', collection.id, 8)
    graph.createVariable(`${variableName} alt`, 'FLOAT', collection.id, 16)
  }

  const bytes = await exportFigFile(graph)
  const { nodeChanges } = parseFigBuffer(bytes.buffer as ArrayBuffer)
  const byParent = positionsByParent(nodeChanges)

  // The internal canvas is the parent all three passes write to.
  const internalCanvas = nodeChanges.find((change) => change.name === 'Internal resources')
  const internalKey = internalCanvas?.guid
    ? `${internalCanvas.guid.sessionID}:${internalCanvas.guid.localID}`
    : ''
  expect(byParent.get(internalKey)?.length ?? 0).toBeGreaterThan(5)

  for (const [parent, positions] of byParent)
    expect([parent, new Set(positions).size]).toEqual([parent, positions.length])
})

/** The pages a saved file lists, in the order Figma sorts them: by their order keys. */
function savedPageOrder(bytes: Uint8Array): string[] {
  return parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
    .nodeChanges.filter((change: NodeChange) => change.type === 'CANVAS' && !change.internalOnly)
    .map((change) => ({
      name: change.name ?? '',
      position: (change.parentIndex as { position?: string } | undefined)?.position ?? ''
    }))
    // Keys are unique and compare by code point, as Figma sorts them.
    .sort((a, b) => (a.position < b.position ? -1 : 1))
    .map((page) => page.name)
}

// The shadcn/ui kit numbers its pages `!`, `~#`, `~#7`…; a page added after them was saved as
// `{`, which sorts before every `~` key, so Figma listed it second.
test('a page added or moved among Figma-numbered pages keeps its place', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const [cover] = graph.getPages()
  graph.updateNode(cover.id, { name: 'Cover', source: { ...cover.source, orderKey: '!' } })
  for (const [name, orderKey] of [
    ['Accordion', '~#'],
    ['Alert', '~#7'],
    ['Trace', '~NO']
  ]) {
    const page = graph.addPage(name)
    graph.updateNode(page.id, { source: { ...page.source, orderKey } })
  }
  graph.addPage('Added')
  expect(savedPageOrder(await exportFigFile(graph))).toEqual([
    'Cover',
    'Accordion',
    'Alert',
    'Trace',
    'Added'
  ])

  // Moved in OpenPencil, a page is saved where it now is, not where its old key put it.
  const trace = graph.getPages().find((page) => page.name === 'Trace')
  graph.insertChildAt(trace?.id ?? '', graph.rootId, 1)
  expect(savedPageOrder(await exportFigFile(graph))).toEqual([
    'Cover',
    'Trace',
    'Accordion',
    'Alert',
    'Added'
  ])
})
