import type { Fill, SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

const TILE = 12
const TARGET = 120
const SOURCES_X = 1200

const BLACK = { r: 0, g: 0, b: 0, a: 1 }
const ACCENT = { r: 0.15, g: 0.4, b: 0.85, a: 1 }

function solid(color: Color): Fill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}

function patternOf(sourceNodeId: string): Fill {
  return {
    type: 'PATTERN',
    color: BLACK,
    opacity: 1,
    visible: true,
    sourceNodeId,
    patternSpacing: { x: 0, y: 0 },
    patternTileType: 'RECTANGULAR',
    horizontalAlignment: 'START',
    verticalAlignment: 'START'
  }
}

function addSourceBuiltFromChildren(graph: SceneGraph, pageId: string): string {
  const source = graph.createNode('FRAME', pageId, {
    name: 'Source from children',
    x: SOURCES_X,
    y: 0,
    width: TILE,
    height: TILE,
    fills: []
  })
  graph.createNode('RECTANGLE', source.id, {
    x: 2,
    y: 2,
    width: 8,
    height: 4,
    fills: [solid(ACCENT)]
  })
  graph.createNode('ELLIPSE', source.id, {
    x: 4,
    y: 7,
    width: 4,
    height: 4,
    fills: [solid(BLACK)]
  })
  return source.id
}

function addSourceDrawnByStrokes(graph: SceneGraph, pageId: string): string {
  const source = graph.createNode('RECTANGLE', pageId, {
    name: 'Source drawn by strokes',
    x: SOURCES_X,
    y: 40,
    width: TILE,
    height: TILE,
    fills: [],
    strokeWeight: 2,
    strokes: [{ ...solid(ACCENT), weight: 2, align: 'INSIDE' }]
  })
  return source.id
}

function addHiddenSourceWithFill(graph: SceneGraph, pageId: string): string {
  const source = graph.createNode('ELLIPSE', pageId, {
    name: 'Hidden source',
    x: SOURCES_X,
    y: 80,
    width: TILE,
    height: TILE,
    visible: false,
    fills: [solid(BLACK)]
  })
  return source.id
}

export function createPatternFillScene(graph: SceneGraph, pageId: string): void {
  const sources = [
    addSourceBuiltFromChildren(graph, pageId),
    addSourceDrawnByStrokes(graph, pageId),
    addHiddenSourceWithFill(graph, pageId)
  ]
  for (const [index, sourceId] of sources.entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Pattern target ${index}`,
      x: 40 + index * (TARGET + 40),
      y: 40,
      width: TARGET,
      height: TARGET,
      fills: [solid({ r: 1, g: 1, b: 1, a: 1 }), patternOf(sourceId)]
    })
  }
}
