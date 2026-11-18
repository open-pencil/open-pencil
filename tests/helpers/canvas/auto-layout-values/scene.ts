import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** What a variant of the row changes: its top and bottom padding, and its rotation. */
export interface ValueSceneVariant {
  paddingTop?: number
  paddingBottom?: number
  rotation?: number
}

/** A row with an 8 px gap and 37 px side padding, as Figma desktop 126 was hovered over. */
export function createAutoLayoutValueScene(
  graph: SceneGraph,
  pageId: string,
  variant: ValueSceneVariant = {}
) {
  const row = graph.createNode('FRAME', pageId, {
    name: 'Row',
    x: 0,
    y: 0,
    width: 242,
    height: 100,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 8,
    paddingLeft: 37,
    paddingRight: 37,
    paddingTop: variant.paddingTop ?? 20,
    paddingBottom: variant.paddingBottom ?? 20,
    fills: [solid(1, 1, 1)]
  })
  for (const name of ['A', 'B'])
    graph.createNode('RECTANGLE', row.id, {
      name,
      width: 80,
      height: 60,
      fills: [solid(0.85, 0.85, 0.85)]
    })
  if (variant.rotation) graph.updateNode(row.id, { rotation: variant.rotation })
  return row.id
}
