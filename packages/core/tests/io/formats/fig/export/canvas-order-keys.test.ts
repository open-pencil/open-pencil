import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { parseFigBuffer } from '@open-pencil/fig'
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
