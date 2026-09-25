import { expect, test } from 'bun:test'

import type { SymbolData } from '#fig/instance-overrides/types'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph, setInstanceOverride, rescaleNodeTree } from '@open-pencil/scene-graph'

test('serializes self size claims against the instance main component', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    width: 100,
    height: 100
  })
  const instance = graph.createInstance(component.id, graph.getPages()[0].id)
  if (!instance) throw new Error('Missing instance')
  rescaleNodeTree(graph, instance.id, 0.5)
  graph.updateNode(instance.id, { width: 16, height: 16, paddingLeft: 10 })
  setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'width', 16)
  setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'paddingLeft', 10)
  setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'height', 16)
  const bytes = await exportFigFile(graph)
  const { nodeChanges } = parseFigBuffer(bytes.buffer as ArrayBuffer)
  const exported = nodeChanges.find((node) => node.type === 'INSTANCE')
  const symbol = exported?.symbolData as SymbolData | undefined
  if (!symbol) throw new Error('Missing exported symbol')
  expect(exported?.size).toEqual({ x: 16, y: 16 })
  expect(symbol.uniformScaleFactor).toBe(0.5)
  expect(symbol.symbolOverrides).toContainEqual({
    guidPath: { guids: [symbol.symbolID] },
    size: { x: 32, y: 32 },
    stackHorizontalPadding: 20
  })
})
