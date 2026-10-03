import { SceneGraph, createSessionIdGenerator } from '@open-pencil/scene-graph'

export function fixture() {
  const graph = new SceneGraph(createSessionIdGenerator(41))
  const page = graph.getPages()[0]
  const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 240, height: 120 })
  graph.updateNode(card.id, { x: 10 })
  const other = graph.createNode('RECTANGLE', page.id, { name: 'Other' })
  return { graph, page, card, other }
}

export function fork(graph: SceneGraph, allocator = createSessionIdGenerator()): SceneGraph {
  const copy = new SceneGraph(allocator)
  copy.nodes = structuredClone(graph.nodes)
  copy.rootId = graph.rootId
  copy.images = structuredClone(graph.images)
  copy.variables = structuredClone(graph.variables)
  copy.variableCollections = structuredClone(graph.variableCollections)
  copy.activeMode = structuredClone(graph.activeMode)
  copy.enabledLibraries = structuredClone(graph.enabledLibraries)
  copy.instanceIndex = structuredClone(graph.instanceIndex)
  copy.documentColorSpace = graph.documentColorSpace
  copy.figKiwiVersion = graph.figKiwiVersion
  copy.figSchemaDeflated = structuredClone(graph.figSchemaDeflated)
  return copy
}
