import { exportFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

import { open } from './archive'

/** A document over four pages: a frame of layers, a component, its instances, and a bound layer. */
export async function fixtureBytes(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const [first] = source.getPages()
  const frame = source.createNode('FRAME', first.id, { name: 'Frame', width: 200, height: 200 })
  for (const [index, name] of ['A', 'B', 'C'].entries())
    source.createNode('RECTANGLE', frame.id, { name, x: index * 30, width: 20, height: 20 })
  source.createNode('ELLIPSE', first.id, { name: 'Dot', x: 300, width: 10, height: 10 })
  const library = source.addPage('Library')
  const component = source.createNode('COMPONENT', library.id, {
    name: 'Card',
    width: 100,
    height: 40
  })
  source.createNode('RECTANGLE', component.id, { name: 'Body', width: 100, height: 40 })
  const used = source.addPage('Used')
  const overridden = source.createInstance(component.id, used.id)
  source.createInstance(component.id, used.id, { x: 200 })
  // An override on the component's layer, which the instance's record addresses by its GUID.
  const [overriddenBody] = source.getChildren(overridden?.id ?? '')
  source.updateNode(overriddenBody.id, { opacity: 0.5 })
  const collection = source.createCollection('Tokens')
  const brand = source.createVariable('brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  source.createNode('RECTANGLE', source.addPage('Bound').id, {
    name: 'Branded',
    width: 10,
    height: 10,
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ],
    boundVariables: { 'fills/0/color': brand.id }
  })
  return exportFigFile(source)
}

export function pageNamed(graph: SceneGraph, name: string): SceneNode {
  const page = graph.getPages().find((candidate) => candidate.name === name)
  if (!page) throw new Error(`Missing page ${name}`)
  return page
}

export function layerNamed(graph: SceneGraph, name: string): SceneNode {
  const layer = [...graph.nodes.values()].find((node) => node.name === name)
  if (!layer) throw new Error(`Missing layer ${name}`)
  return layer
}

export interface LayerShape {
  name: string
  type: string
  bounds: number[]
  children: LayerShape[]
}

/** What a reopened document shows, independent of the IDs one session gave its layers. */
export async function shapeOf(bytes: Uint8Array): Promise<Record<string, LayerShape[]>> {
  const graph = await open(bytes)
  populateAllFigPages(graph)
  const shape = (node: SceneNode): LayerShape => ({
    name: node.name,
    type: node.type,
    bounds: [node.x, node.y, node.width, node.height].map((value) => Math.round(value * 100)),
    children: graph.getChildren(node.id).map(shape)
  })
  return Object.fromEntries(
    graph.getPages().map((page) => [page.name, graph.getChildren(page.id).map(shape)])
  )
}

export const guidKey = (record: NodeChange) => (record.guid ? guidToString(record.guid) : '')

/** The records of an archive by GUID. */
export function recordsOf(bytes: Uint8Array) {
  const { nodeChanges } = parseFigBuffer(bytes.slice().buffer)
  return new Map(
    nodeChanges.flatMap((record) => (record.guid ? [[guidToString(record.guid), record]] : []))
  )
}

/**
 * Export one edit both ways: writing the changed records into the archive, and the whole
 * document as before. Both must reopen the same.
 */
export async function exportBothWays(edit: (graph: SceneGraph) => void) {
  const bytes = await fixtureBytes()
  const patchedGraph = await open(bytes)
  edit(patchedGraph)
  const patched = await exportFigFile(patchedGraph)
  const fullGraph = await open(bytes)
  edit(fullGraph)
  releaseFigArchive(fullGraph)
  const full = await exportFigFile(fullGraph)
  return { bytes, patched, full }
}
