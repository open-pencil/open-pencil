import type { Color, Fill, SceneGraph } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0.3, b: 0.2, a: 1 }
const BLUE = { r: 0.2, g: 0.4, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }

function solid(color: Color): Fill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}

/**
 * The layers Figma desktop 126 was probed with: a frame, an auto layout frame with a child, two
 * rectangles that differ in size, radius, opacity, stroke, and effects, an ellipse, and two texts.
 */
export function createMixedSelectionScene(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Mix Frame',
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    cornerRadius: 8,
    fills: [solid({ r: 1, g: 1, b: 1, a: 1 })]
  })
  const auto = graph.createNode('FRAME', pageId, {
    name: 'Mix Auto',
    x: 260,
    y: 0,
    width: 72,
    height: 100,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fills: [solid({ r: 0.9, g: 0.95, b: 1, a: 1 })]
  })
  graph.createNode('RECTANGLE', auto.id, {
    name: 'Rectangle',
    width: 40,
    height: 40,
    fills: [solid({ r: 0.85, g: 0.85, b: 0.85, a: 1 })]
  })
  const rectA = graph.createNode('RECTANGLE', pageId, {
    name: 'Mix Rect A',
    x: 0,
    y: 180,
    width: 100,
    height: 80,
    cornerRadius: 4,
    opacity: 0.5,
    fills: [solid(RED)],
    strokes: [{ ...solid(BLACK), weight: 2, align: 'INSIDE' }]
  })
  const rectB = graph.createNode('RECTANGLE', pageId, {
    name: 'Mix Rect B',
    x: 140,
    y: 180,
    width: 120,
    height: 80,
    cornerRadius: 12,
    fills: [solid(RED)],
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  })
  const ellipse = graph.createNode('ELLIPSE', pageId, {
    name: 'Mix Ellipse',
    x: 300,
    y: 180,
    width: 80,
    height: 80,
    fills: [solid(BLUE)]
  })
  const textA = graph.createNode('TEXT', pageId, {
    name: 'Mix Text A',
    x: 0,
    y: 300,
    text: 'Hello',
    fontSize: 16,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(BLACK)]
  })
  const textB = graph.createNode('TEXT', pageId, {
    name: 'Mix Text B',
    x: 140,
    y: 300,
    text: 'World',
    fontSize: 24,
    fontWeight: 700,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(BLACK)]
  })
  return {
    frame: frame.id,
    auto: auto.id,
    rectA: rectA.id,
    rectB: rectB.id,
    ellipse: ellipse.id,
    textA: textA.id,
    textB: textB.id
  }
}
