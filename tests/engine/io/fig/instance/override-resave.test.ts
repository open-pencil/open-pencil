import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

const BLUE = { r: 0, g: 0, b: 1, a: 1 }
const RED = { r: 1, g: 0, b: 0, a: 1 }

function findInstanceAndVector(graph: SceneGraph) {
  const instance = [...graph.getAllNodes()].find((n) => n.type === 'INSTANCE')
  if (!instance) throw new Error('instance not found')
  const vector = graph.getChildren(instance.id)[0]
  return { instance, vector }
}

describe('re-editing an instance fill across multiple save/reload cycles', () => {
  test('a second live edit overrides the first, not the other way around', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon' })
    graph.createNode('VECTOR', icon.id, {
      name: 'path',
      width: 16,
      height: 16,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const instance = graph.createInstance(icon.id, page.id)
    if (!instance) throw new Error('failed to create instance')
    const figma1 = new FigmaAPI(graph)
    const vectorProxy1 = figma1.getNodeById(graph.getChildren(instance.id)[0].id)
    if (!vectorProxy1) throw new Error('vector proxy not found')
    vectorProxy1.fills = [{ type: 'SOLID', color: BLUE, opacity: 1, visible: true }]

    // Round 1: export the blue edit, reimport it — this is the state a
    // freshly-reopened file would be in, with `blue` baked into the stored
    // symbolOverride but no live `overrides` bookkeeping (per §1 of the fix).
    const bytes1 = await exportFigFile(graph)
    const graph2 = await parseFigFile(bytes1.buffer as ArrayBuffer)
    const { vector: vector2 } = findInstanceAndVector(graph2)
    expect(vector2.fills[0]?.color).toEqual(BLUE)

    // Round 2: live-edit the reimported instance's icon to red, then export
    // and reimport again. Without the fix, `applySymbolOverrides` reapplies
    // the STALE stored (blue) override on this same export pass, silently
    // discarding the fresh (red) edit.
    const figma2 = new FigmaAPI(graph2)
    const vectorProxy2 = figma2.getNodeById(vector2.id)
    if (!vectorProxy2) throw new Error('vector proxy not found')
    vectorProxy2.fills = [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]

    const bytes2 = await exportFigFile(graph2)
    const graph3 = await parseFigFile(bytes2.buffer as ArrayBuffer)
    const { vector: vector3 } = findInstanceAndVector(graph3)
    expect(vector3.fills[0]?.color).toEqual(RED)
  })
})
