import { readFile, writeFile } from 'node:fs/promises'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const [operation, componentId] = process.argv.slice(2)

function createGraph() {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Button',
    componentPropertyDefinitions: [
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  for (const [index, size] of ['Small', 'Large'].entries())
    graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      x: index * 100,
      width: 40 + index * 40,
      height: 20,
      componentPropertyValues: { Size: size }
    })
  return graph
}

async function renameGraph() {
  const { graph } = await io.readDocument({
    name: 'design.fig',
    data: new Uint8Array(await readFile('design.fig'))
  })
  populateAllFigPages(graph)
  const original = Array.from(graph.getAllNodes()).find((node) => node.source.id === componentId)
  if (!original) throw new Error('Expected saved component')
  graph.updateNode(original.id, { name: 'Renamed button' })
  graph.createNode('COMPONENT', graph.getPages()[0].id, { name: 'Renamed button' })
  return graph
}

let graph: SceneGraph
if (operation === 'create') graph = createGraph()
else if (operation === 'rename') graph = await renameGraph()
else throw new Error(`Unknown FIG fixture operation: ${operation}`)
const result = await io.writeDocument('fig', graph)
if (!(result.data instanceof Uint8Array)) throw new Error('Expected FIG bytes')
await writeFile('design.fig', result.data)
