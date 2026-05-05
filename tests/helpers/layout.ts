import { readFigFile, SceneGraph } from '@open-pencil/core'

import type { GridTrack, SceneNode } from '@open-pencil/core'

export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export function autoFrame(
  graph: SceneGraph,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 400,
    height: 200,
    ...overrides
  })
}

export function rect(
  graph: SceneGraph,
  parentId: string,
  w = 50,
  h = 50,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    name: 'Rect',
    width: w,
    height: h,
    ...overrides
  })
}

export async function loadFixtureGraph(name: string) {
  const path = new URL(`../fixtures/${name}`, import.meta.url)
  const buffer = await Bun.file(path).arrayBuffer()
  const file = new File([buffer], name, { type: 'application/octet-stream' })
  return readFigFile(file)
}

export function gridFrame(
  graph: SceneGraph,
  parentId: string,
  columns: GridTrack[],
  rows: GridTrack[],
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'GRID',
    width: 400,
    height: 300,
    gridTemplateColumns: columns,
    gridTemplateRows: rows,
    gridColumnGap: 0,
    gridRowGap: 0,
    ...overrides
  })
}

export function fr(value = 1): GridTrack {
  return { sizing: 'FR', value }
}

export function fixed(value: number): GridTrack {
  return { sizing: 'FIXED', value }
}
