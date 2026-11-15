import type { Effect, SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { solid } from '../paints'

function effect(type: Effect['type'], radius: number, color = { r: 0, g: 0, b: 0, a: 1 }): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y: 0 },
    color,
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

/** Where each layer draws ink that a layer bound to its box would cut, and a point left blank. */
export interface LayerBoundsProbes {
  glow: Vector
  childShadow: Vector
  turnedMask: Vector
  turnedMaskShadow: Vector
  blank: Vector
}

/** A 6px dot whose spread shadow glows 8px around it, under a 1px layer blur. */
function addGlowingDot(graph: SceneGraph, pageId: string): Vector {
  graph.createNode('ELLIPSE', pageId, {
    name: 'Glowing dot',
    x: 80,
    y: 80,
    width: 6,
    height: 6,
    fills: [solid(1, 0.9, 0.7)],
    effects: [
      {
        ...effect('DROP_SHADOW', 8, { r: 1, g: 0.35, b: 0, a: 1 }),
        spread: 8,
        showShadowBehindNode: true
      },
      effect('LAYER_BLUR', 1)
    ]
  })
  const dotRight = 86
  const blurLayerRightOnMaster = dotRight + 2
  return { x: blurLayerRightOnMaster + 4, y: 83 }
}

/** A 40px frame at 60% opacity whose child runs 120px past it and casts the frame's shadow. */
function addFrameShadowedByItsChild(graph: SceneGraph, pageId: string): Vector {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Frame shadowed by its child',
    x: 160,
    y: 60,
    width: 40,
    height: 40,
    opacity: 0.6,
    fills: [],
    clipsContent: false,
    effects: [{ ...effect('DROP_SHADOW', 12), spread: 6 }]
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Child past the box',
    x: 60,
    width: 100,
    height: 40,
    fills: [solid(0.23, 0.51, 0.96)]
  })
  const childRight = 160 + 60 + 100
  return { x: childRight + 3, y: 80 }
}

/**
 * A bar turned by 90 degrees with a spread shadow, masking a red sheet whose own box is a 10px
 * square in the corner across from where the bar turned, so only the mask's turned bounds can
 * hold what it masks in.
 */
function addTurnedMask(
  graph: SceneGraph,
  pageId: string
): { turnedMask: Vector; turnedMaskShadow: Vector } {
  const group = graph.createNode('FRAME', pageId, {
    name: 'Turned mask',
    x: 360,
    y: 0,
    width: 400,
    height: 400,
    fills: [],
    clipsContent: false
  })
  const mask = graph.createNode('RECTANGLE', group.id, {
    name: 'Mask',
    x: 150,
    y: 190,
    width: 100,
    height: 20,
    rotation: 90,
    fills: [solid(0, 0, 0)],
    isMask: true,
    maskType: 'ALPHA',
    effects: [{ ...effect('DROP_SHADOW', 0), spread: 10 }]
  })
  const toPage = getWorldMatrix(mask, graph)
  const [maskX, maskY, shadowX, shadowY] = Matrix.mapPoints(toPage, [95, 10, 95, 25])
  const sheetX = maskX - 360 > 200 ? 0 : 390
  const sheetY = maskY > 200 ? 0 : 390
  const sheetHolder = graph.createNode('FRAME', group.id, {
    name: 'Sheet holder',
    x: sheetX,
    y: sheetY,
    width: 10,
    height: 10,
    fills: [],
    clipsContent: false
  })
  graph.createNode('RECTANGLE', sheetHolder.id, {
    name: 'Sheet',
    x: -sheetX,
    y: -sheetY,
    width: 400,
    height: 400,
    fills: [solid(0.94, 0.27, 0.27)]
  })
  return {
    turnedMask: { x: maskX, y: maskY },
    turnedMaskShadow: { x: shadowX, y: shadowY }
  }
}

/**
 * A glowing dot under a layer blur, a translucent frame whose shadow its child casts past the
 * frame's box, and a turned mask with a shadow: each draws where a layer bounded by its unturned
 * box would cut.
 */
export function createLayerBoundsScene(graph: SceneGraph, pageId: string): LayerBoundsProbes {
  return {
    glow: addGlowingDot(graph, pageId),
    childShadow: addFrameShadowedByItsChild(graph, pageId),
    ...addTurnedMask(graph, pageId),
    blank: { x: 120, y: 300 }
  }
}
