import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile } from '@lawha/core/io/formats/fig'
import { parseFigBuffer } from '@lawha/fig'
import { symbolDataOf } from '@lawha/fig/instance-overrides'
import { initCodec } from '@lawha/kiwi/fig/codec'
import { SceneGraph } from '@lawha/scene-graph'
import { setInstanceOverride } from '@lawha/scene-graph/instances/overrides'
import { rescaleNodeTree } from '@lawha/scene-graph/scaling'

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
  const symbol = exported ? symbolDataOf(exported) : undefined
  if (!symbol) throw new Error('Missing exported symbol')
  expect(exported?.size).toEqual({ x: 16, y: 16 })
  expect(symbol.uniformScaleFactor).toBe(0.5)
  expect(symbol.symbolOverrides).toContainEqual({
    guidPath: { guids: [expectDefined(symbol.symbolID)] },
    size: { x: 32, y: 32 },
    stackHorizontalPadding: 20
  })
})
