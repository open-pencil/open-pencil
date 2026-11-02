import type { Effect, SceneGraph } from '@open-pencil/scene-graph'

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

function effect(type: Effect['type'], radius: number, y = 0): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y },
    color: { r: 0.06, g: 0.09, b: 0.16, a: 0.6 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

/**
 * Layer blur, drop and inner shadow, and background blur, each at a 16px radius, plus a drop
 * shadow, shown behind the node, under a fill at 0% opacity, which casts nothing; a boolean's
 * background blur, inside its result alone; and sharp inner shadows over the rounded corners of
 * an opaque and a translucent fill, where no fill shows through the edge.
 */
export function createBlurEffectsScene(graph: SceneGraph, pageId: string): void {
  const card = { y: 100, width: 120, height: 120, cornerRadius: 20 }
  graph.createNode('RECTANGLE', pageId, {
    name: 'Layer blur',
    x: 80,
    ...card,
    fills: [solid(0.31, 0.27, 0.9)],
    effects: [effect('LAYER_BLUR', 16)]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Drop shadow',
    x: 260,
    ...card,
    fills: [solid(1, 1, 1)],
    effects: [effect('DROP_SHADOW', 16, 8)]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Inner shadow',
    x: 440,
    ...card,
    fills: [solid(1, 1, 1)],
    effects: [effect('INNER_SHADOW', 16, 8)]
  })
  for (const [index, color] of [
    [0.96, 0.35, 0.35],
    [0.08, 0.73, 0.73],
    [0.23, 0.51, 0.96]
  ].entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Stripe ${index + 1}`,
      x: 620 + index * 40,
      y: 100,
      width: 40,
      height: 120,
      fills: [solid(color[0], color[1], color[2])]
    })
  }
  graph.createNode('RECTANGLE', pageId, {
    name: 'Background blur',
    x: 640,
    y: 120,
    width: 80,
    height: 80,
    cornerRadius: 16,
    fills: [solid(1, 1, 1, 0.2)],
    effects: [effect('BACKGROUND_BLUR', 16)]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Transparent fill shadow',
    x: 80,
    ...card,
    y: 280,
    fills: [solid(1, 1, 1, 0)],
    effects: [
      {
        ...effect('DROP_SHADOW', 16, 8),
        color: { r: 0, g: 0, b: 0, a: 1 },
        showShadowBehindNode: true
      }
    ]
  })
  for (const [index, color] of [
    [0.96, 0.35, 0.35],
    [0.08, 0.73, 0.73],
    [0.23, 0.51, 0.96]
  ].entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Union stripe ${index + 1}`,
      x: 260 + index * 40,
      y: 280,
      width: 40,
      height: 120,
      fills: [solid(color[0], color[1], color[2])]
    })
  }
  const union = graph.createNode('BOOLEAN_OPERATION', pageId, {
    name: 'Union background blur',
    x: 260,
    y: 280,
    width: 120,
    height: 120,
    booleanOperation: 'UNION',
    fills: [solid(1, 1, 1, 0.2)],
    effects: [effect('BACKGROUND_BLUR', 16)]
  })
  graph.createNode('ELLIPSE', union.id, { width: 70, height: 70 })
  graph.createNode('ELLIPSE', union.id, { x: 50, y: 50, width: 70, height: 70 })
  for (const [index, opacity] of [1, 0.5].entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Rounded inner shadow ${opacity * 100}%`,
      x: 440 + index * 180,
      ...card,
      y: 280,
      cornerRadius: 40,
      fills: [solid(0.96, 0.35, 0.35, opacity)],
      effects: [
        {
          ...effect('INNER_SHADOW', 0),
          spread: 6,
          offset: { x: 8, y: 8 },
          color: { r: 0, g: 0, b: 0, a: 1 }
        }
      ]
    })
  }
}

function shadow(type: 'DROP_SHADOW' | 'INNER_SHADOW', showShadowBehindNode = false): Effect {
  return {
    type,
    radius: 12,
    spread: 0,
    offset: { x: 8, y: 10 },
    color: { r: 0, g: 0, b: 0, a: 0.45 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode
  }
}

/**
 * Shadows cast from what each layer draws, in three rows: strokes and translucent fills, the
 * children of frames and groups, and where inner shadows sit.
 */
export function createShadowSilhouetteScene(graph: SceneGraph, pageId: string): void {
  const blue = solid(0.23, 0.4, 0.95)
  const green = solid(0.1, 0.7, 0.45)
  const yellow = solid(1, 0.85, 0.3)
  const box = (index: number, row: number) => ({
    x: 80 + index * 200,
    y: 80 + row * 180,
    width: 150,
    height: 110
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Stroke without fill',
    ...box(0, 0),
    cornerRadius: 16,
    fills: [],
    strokes: [{ ...blue, weight: 6, align: 'CENTER' }],
    strokeWeight: 6,
    strokeAlign: 'CENTER',
    effects: [shadow('DROP_SHADOW')]
  })
  for (const [index, showBehind] of [
    [1, false],
    [2, true]
  ] as const) {
    graph.createNode('RECTANGLE', pageId, {
      name: showBehind ? 'Translucent, shown behind' : 'Translucent',
      ...box(index, 0),
      cornerRadius: 16,
      fills: [solid(0.23, 0.4, 0.95, 0.35)],
      effects: [shadow('DROP_SHADOW', showBehind)]
    })
  }
  graph.createNode('RECTANGLE', pageId, {
    name: 'Fill at 0%',
    ...box(3, 0),
    fills: [solid(1, 0, 0, 0)],
    effects: [shadow('DROP_SHADOW', true)]
  })

  const wrapper = graph.createNode('FRAME', pageId, {
    name: 'Frame without fill',
    ...box(0, 1),
    fills: [],
    clipsContent: false,
    effects: [shadow('DROP_SHADOW')]
  })
  graph.createNode('ELLIPSE', wrapper.id, { x: 0, y: 10, width: 64, height: 64, fills: [blue] })
  graph.createNode('RECTANGLE', wrapper.id, {
    x: 74,
    y: 30,
    width: 76,
    height: 80,
    cornerRadius: 12,
    fills: [green]
  })
  const card = graph.createNode('FRAME', pageId, {
    name: 'Overflowing child',
    ...box(1, 1),
    x: box(1, 1).x + 30,
    width: 120,
    cornerRadius: 12,
    fills: [solid(1, 1, 1)],
    clipsContent: false,
    effects: [shadow('DROP_SHADOW')]
  })
  graph.createNode('RECTANGLE', card.id, {
    x: -30,
    y: 40,
    width: 70,
    height: 36,
    cornerRadius: 8,
    fills: [blue]
  })
  const group = graph.createNode('GROUP', pageId, {
    name: 'Group with a 0% shape',
    ...box(2, 1),
    effects: [shadow('DROP_SHADOW')]
  })
  graph.createNode('RECTANGLE', group.id, {
    x: 0,
    y: 0,
    width: 150,
    height: 110,
    fills: [solid(1, 0, 0, 0)]
  })
  graph.createNode('RECTANGLE', group.id, { x: 35, y: 25, width: 80, height: 60, fills: [green] })
  const union = graph.createNode('BOOLEAN_OPERATION', pageId, {
    name: 'Union',
    ...box(3, 1),
    booleanOperation: 'UNION',
    fills: [blue],
    effects: [shadow('DROP_SHADOW')]
  })
  graph.createNode('RECTANGLE', union.id, { x: 0, y: 0, width: 100, height: 60 })
  graph.createNode('ELLIPSE', union.id, { x: 60, y: 30, width: 90, height: 80 })

  graph.createNode('RECTANGLE', pageId, {
    name: 'Inner shadow under stroke',
    ...box(0, 2),
    fills: [yellow],
    strokes: [{ ...solid(0.23, 0.4, 0.95, 0.5), weight: 12, align: 'INSIDE' }],
    strokeWeight: 12,
    strokeAlign: 'INSIDE',
    effects: [shadow('INNER_SHADOW')]
  })
  const clipped = graph.createNode('FRAME', pageId, {
    name: 'Inner shadow over child',
    ...box(1, 2),
    fills: [yellow],
    clipsContent: true,
    effects: [shadow('INNER_SHADOW')]
  })
  graph.createNode('RECTANGLE', clipped.id, { x: 0, y: 0, width: 150, height: 40, fills: [blue] })
  const innerWrapper = graph.createNode('FRAME', pageId, {
    name: 'Inner shadow on every child',
    ...box(2, 2),
    fills: [],
    clipsContent: false,
    effects: [shadow('INNER_SHADOW')]
  })
  graph.createNode('ELLIPSE', innerWrapper.id, {
    x: 0,
    y: 10,
    width: 64,
    height: 64,
    fills: [blue]
  })
  graph.createNode('RECTANGLE', innerWrapper.id, {
    x: 74,
    y: 30,
    width: 76,
    height: 80,
    cornerRadius: 12,
    fills: [green]
  })
}
