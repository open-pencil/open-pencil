export {}

const mod = await import('../dist/index.js')

const graph = new mod.SceneGraph()
const page = graph.getPages()[0]
const node = graph.createNode('RECTANGLE', page.id, { width: 10, height: 20 })

if (graph.getNode(node.id)?.width !== 10) {
  throw new Error('Expected built SceneGraph package to create nodes')
}
