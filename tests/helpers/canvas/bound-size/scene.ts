import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * A read-only library component whose width is bound to a fractional variable, so the panel gives
 * its W field 100 while the variable holds 100.4, and a plain frame; each has a Left & right child.
 */
export function createBoundSizeScene(graph: SceneGraph, pageId: string) {
  const collection = graph.createCollection('Sizes')
  const variable = graph.createVariable('Card width', 'FLOAT', collection.id, 100.4)
  const remote = graph.createNode('COMPONENT', pageId, {
    name: 'Remote card',
    x: 300,
    width: 100.4,
    height: 50
  })
  graph.createNode('RECTANGLE', remote.id, {
    width: 20,
    height: 10,
    horizontalConstraint: 'STRETCH'
  })
  graph.bindVariable(remote.id, 'width', variable.id)
  graph.updateNode(remote.id, {
    librarySource: {
      identity: { libraryId: 'design-system', assetKey: 'card', revisionId: 'r1' },
      sourceNodeId: 'source',
      readOnly: true
    }
  })
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Plain frame',
    x: 300,
    y: 200,
    width: 100,
    height: 50
  })
  const bar = graph.createNode('RECTANGLE', frame.id, {
    width: 20,
    height: 10,
    horizontalConstraint: 'STRETCH'
  })
  return { remote: remote.id, frame: frame.id, bar: bar.id }
}
