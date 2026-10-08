import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

const red = { r: 1, g: 0, b: 0, a: 1 }
const blue = { r: 0, g: 0, b: 1, a: 1 }

async function reopenedInstance() {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page, { name: 'Card', width: 100, height: 50 })
  graph.createNode('RECTANGLE', component.id, {
    name: 'Surface',
    width: 100,
    height: 50,
    fills: [{ type: 'SOLID', color: red, opacity: 1, visible: true }]
  })
  graph.createInstance(component.id, page, { x: 200 })
  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const instance = [...reopened.nodes.values()].find((node) => node.type === 'INSTANCE')
  const [layer] = reopened.getChildren(instance?.id ?? '')
  const source = reopened.getNode(layer?.componentId ?? '')
  if (!layer || !source) throw new Error('Missing instance layer or its component layer')
  return { graph: reopened, layer, source }
}

// A design kit holds many instances of each component; their layers hold the component layers'
// own objects for what no override changed, rather than one copy each.
test('a layer inside an instance holds its component layer’s unchanged values', async () => {
  const { layer, source } = await reopenedInstance()

  expect(layer.fills).toBe(source.fills)
  expect(layer.effects).toBe(source.effects)
  expect(layer.source).not.toBe(source.source)
  expect(layer.instanceOverrides).not.toBe(source.instanceOverrides)
})

test('changing a layer inside an instance leaves its component layer as it was', async () => {
  const { graph, layer, source } = await reopenedInstance()
  const before: SceneNode = structuredClone(source)

  graph.updateNode(layer.id, { fills: [{ type: 'SOLID', color: blue, opacity: 1, visible: true }] })

  expect(graph.getNode(layer.id)?.fills[0].color).toEqual(blue)
  expect(graph.getNode(source.id)).toEqual(before)
})
