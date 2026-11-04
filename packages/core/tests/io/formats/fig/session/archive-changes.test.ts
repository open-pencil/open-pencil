import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { parseFigBuffer } from '@open-pencil/fig'
import { derivedSymbolDataOf, symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { archiveChanges } from '#core/kiwi/fig/session/archive/changes'

async function reopen(source: SceneGraph) {
  await initCodec()
  const graph = await parseFigFile((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  const page = graph.getPages()[0]
  const layer = (name: string) => {
    const found = [...graph.nodes.values()].find((node) => node.name === name)
    if (!found) throw new Error(`Missing ${name}`)
    return found
  }
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, page.id))
  return { graph, page, layer }
}

/** A row whose saved child positions are not where auto layout puts them. */
async function openRow() {
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
  return reopen(source)
}

/** A hugging column inside a hugging frame, saved with its children at `ys`. */
async function openColumn(itemSpacing: number, ys: [number, number]) {
  const source = new SceneGraph()
  const outer = source.createNode('FRAME', source.getPages()[0].id, {
    name: 'Outer',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    width: 50,
    height: 20 + 20 + itemSpacing
  })
  const column = source.createNode('FRAME', outer.id, {
    name: 'Column',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    itemSpacing,
    width: 50,
    height: 20 + 20 + itemSpacing
  })
  source.createNode('RECTANGLE', column.id, { name: 'A', y: ys[0], width: 50, height: 20 })
  source.createNode('RECTANGLE', column.id, { name: 'B', y: ys[1], width: 50, height: 20 })
  return reopen(source)
}

async function savedRecords(graph: SceneGraph) {
  const bytes = await exportFigFile(graph)
  const records = parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges
  return (name: string): NodeChange => {
    const found = records.find((record) => record.name === name)
    if (!found) throw new Error(`Missing saved ${name}`)
    return found
  }
}

test('the layout a page gets as it loads is no change to its archive', async () => {
  const { graph, layer } = await openRow()
  expect(layer('Second').x).toBe(60)
  expect([...(archiveChanges(graph)?.touched ?? [])]).toEqual([])
})

test('the layout a page gets as it loads keeps the positions the file saved', async () => {
  const { graph } = await openRow()
  const saved = await savedRecords(graph)
  expect(['First', 'Second', 'Third'].map((name) => saved(name).transform?.m02)).toEqual([0, 0, 0])
})

test('the layout an edit causes changes the layers it moves', async () => {
  const { graph, page, layer } = await openRow()
  graph.updateNode(layer('First').id, { width: 80 })
  computeAllLayouts(graph, page.id)
  const touched = new Set(archiveChanges(graph)?.touched)
  expect(['First', 'Second', 'Third'].filter((name) => touched.has(layer(name).id))).toEqual([
    'First',
    'Second',
    'Third'
  ])
})

test('a gap edit saves where layout moved the layers after it', async () => {
  const { graph, page, layer } = await openColumn(12, [0, 32])
  graph.updateNode(layer('Column').id, { itemSpacing: 40 })
  computeAllLayouts(graph, page.id)
  expect(layer('B').y).toBe(60)
  const saved = await savedRecords(graph)
  expect(saved('A').transform?.m12).toBe(0)
  expect(saved('B').transform?.m12).toBe(60)
  expect(saved('Column').size?.y).toBe(80)
})

test('a gap edit saves the position layout gives a layer the file saved elsewhere', async () => {
  const { graph, page, layer } = await openColumn(13, [0, 0])
  expect(layer('B').y).toBe(33)
  graph.updateNode(layer('Column').id, { itemSpacing: 12 })
  computeAllLayouts(graph, page.id)
  const saved = await savedRecords(graph)
  expect(saved('B').transform?.m12).toBe(32)
})

test('a gap edit saves the size of the hugging frames around it', async () => {
  const { graph, page, layer } = await openColumn(12, [0, 32])
  graph.updateNode(layer('Column').id, { itemSpacing: 40 })
  computeAllLayouts(graph, page.id)
  expect(layer('Outer').height).toBe(80)
  const saved = await savedRecords(graph)
  expect(saved('Outer').size?.y).toBe(80)
  expect(saved('Column').transform?.m12).toBe(0)
})

test('a gap edit committed from a preview saves the layers its layout moved', async () => {
  const { graph, layer } = await openColumn(12, [0, 32])
  const editor = createEditor({ graph })
  const preview = editor.beginNodePreview('Gap')
  preview.update(layer('Column').id, { itemSpacing: 40 })
  preview.commit()
  expect(layer('B').y).toBe(60)
  const saved = await savedRecords(graph)
  expect(saved('B').transform?.m12).toBe(60)
  expect(saved('Column').size?.y).toBe(80)
  expect(saved('Outer').size?.y).toBe(80)
})

/** A component in a set and an instance of it, its layers saved where layout puts them. */
async function openComponent() {
  const source = new SceneGraph()
  const pageId = source.getPages()[0].id
  const set = source.createNode('COMPONENT_SET', pageId, { name: 'Cards', width: 50, height: 52 })
  const card = source.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    itemSpacing: 12,
    width: 50,
    height: 52
  })
  source.createNode('RECTANGLE', card.id, { name: 'A', width: 50, height: 20 })
  source.createNode('RECTANGLE', card.id, { name: 'B', y: 32, width: 50, height: 20 })
  source.createInstance(card.id, pageId, { name: 'Card', x: 100 })
  return reopen(source)
}

function geometryOverrides(record: NodeChange) {
  return symbolOverridesOf(record).filter(
    (entry) => entry.transform !== undefined || entry.size !== undefined
  )
}

test('a component gap edit saves its instances as layout places them, not as overrides', async () => {
  const { graph, layer } = await openComponent()
  const editor = createEditor({ graph })
  editor.updateNodeWithUndo(layer('Size=Small').id, { itemSpacing: 40 })
  // Component edits reach their instances in a microtask.
  await Promise.resolve()
  const instance = layer('Card')
  expect(instance.height).toBe(80)
  expect(graph.getChildren(instance.id).map((child) => child.y)).toEqual([0, 60])
  const saved = await savedRecords(graph)
  expect(saved('B').transform?.m12).toBe(60)
  const card = saved('Card')
  expect(card.size?.y).toBe(80)
  expect(geometryOverrides(card)).toEqual([])
  expect(
    derivedSymbolDataOf(card)
      .map((entry) => entry.transform?.m12 ?? 0)
      .toSorted((a, b) => a - b)
  ).toEqual([0, 60])
})
