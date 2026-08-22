import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('instance descendant fill override round trip', () => {
  test('a recolored nested instance child keeps its color after a save/reload cycle', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon' })
    const path = graph.createNode('VECTOR', icon.id, {
      name: 'path',
      width: 16,
      height: 16,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const instance = graph.createInstance(icon.id, page.id)
    if (!instance) throw new Error('failed to create instance')
    const instancePath = graph.getChildren(instance.id)[0]
    expect(instancePath.componentId).toBe(path.id)

    graph.updateNode(instancePath.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const { recordInstanceOverride } = await import('@open-pencil/scene-graph')
    recordInstanceOverride(graph, instancePath.id, ['fills'])

    const exported = await exportFigFile(graph)
    const reloaded = await parseFigFile(exported.buffer as ArrayBuffer)

    const reloadedInstance = reloaded.getAllNodes().find((n) => n.type === 'INSTANCE')
    expect(reloadedInstance).toBeDefined()
    const reloadedPath = reloadedInstance ? reloaded.getChildren(reloadedInstance.id)[0] : undefined
    expect(reloadedPath?.fills[0]?.color).toEqual({ r: 0, g: 0, b: 1, a: 1 })

    const reloadedIcon = reloaded.getAllNodes().find((n) => n.type === 'COMPONENT' && n.name === 'Icon')
    const reloadedIconPath = reloadedIcon ? reloaded.getChildren(reloadedIcon.id)[0] : undefined
    expect(reloadedIconPath?.fills[0]?.color).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })
})
