import { expect, test } from 'bun:test'

import { computeAllLayouts, exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { archiveChanges } from '#core/kiwi/fig/session/archive-changes'

/** A row whose saved child positions are not where auto layout puts them. */
async function openRow() {
  await initCodec()
  const source = new SceneGraph()
  const row = source.createNode('FRAME', source.getPages()[0].id, {
    name: 'Row',
    layoutMode: 'HORIZONTAL',
    itemSpacing: 10,
    width: 300,
    height: 40
  })
  for (const name of ['First', 'Second', 'Third'])
    source.createNode('RECTANGLE', row.id, { name, x: 0, width: 50, height: 20 })
  const graph = await parseFigFile((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  const page = graph.getPages()[0]
  const layer = (name: string) => {
    const found = [...graph.nodes.values()].find((node) => node.name === name)
    if (!found) throw new Error(`Missing ${name}`)
    return found
  }
  return { graph, page, layer }
}

test('the layout a page gets as it loads is no change to its archive', async () => {
  const { graph, page, layer } = await openRow()
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, page.id))
  expect(layer('Second').x).toBe(60)
  expect([...(archiveChanges(graph)?.touched ?? [])]).toEqual([])
})

test('the layout an edit causes changes the layers it moves', async () => {
  const { graph, page, layer } = await openRow()
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, page.id))
  graph.updateNode(layer('First').id, { width: 80 })
  computeAllLayouts(graph, page.id)
  const touched = new Set(archiveChanges(graph)?.touched)
  expect(['First', 'Second', 'Third'].filter((name) => touched.has(layer(name).id))).toEqual([
    'First',
    'Second',
    'Third'
  ])
})
