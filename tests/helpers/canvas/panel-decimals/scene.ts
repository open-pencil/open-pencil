import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * Layers with the fractional values Figma desktop was probed with: a box at x 100.375 sized
 * 151.25 × 33.333333, a turned box, an auto layout frame with fractional padding and gap, and two
 * boxes a third of 100 wide.
 */
export function createPanelDecimalsScene(graph: SceneGraph, pageId: string) {
  const measured = graph.createNode('RECTANGLE', pageId, {
    name: 'Measured',
    x: 100.375,
    y: 40,
    width: 151.25,
    height: 33.333333
  })
  const turned = graph.createNode('RECTANGLE', pageId, {
    name: 'Turned',
    x: 400,
    y: 40,
    width: 40,
    height: 20,
    rotation: 30.126
  })
  const padded = graph.createNode('FRAME', pageId, {
    name: 'Padded',
    x: 100,
    y: 200,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 10.5,
    paddingRight: 12.25,
    paddingTop: 3.333,
    paddingBottom: 4,
    itemSpacing: 7.75
  })
  for (const name of ['One', 'Two']) {
    graph.createNode('RECTANGLE', padded.id, { name, width: 20, height: 20 })
  }
  const thirds = ['Third A', 'Third B'].map(
    (name, i) =>
      graph.createNode('RECTANGLE', pageId, {
        name,
        x: 400 + i * 60,
        y: 200,
        width: 33.333333,
        height: 20
      }).id
  )
  return { measured: measured.id, turned: turned.id, padded: padded.id, thirds }
}
