import type { Effect, SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** Three 40×120 stripes, red, teal, and blue, from `x`,`y`, named `<name> 1` to `<name> 3`. */
function addStripes(graph: SceneGraph, pageId: string, name: string, x: number, y: number) {
  const colors = [
    [0.96, 0.35, 0.35],
    [0.08, 0.73, 0.73],
    [0.23, 0.51, 0.96]
  ] as const
  return colors.map(
    ([r, g, b], index) =>
      graph.createNode('RECTANGLE', pageId, {
        name: `${name} ${index + 1}`,
        x: x + index * 40,
        y,
        width: 40,
        height: 120,
        fills: [solid(r, g, b)]
      }).id
  )
}

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
 * background blur, inside its result alone; sharp inner shadows over the rounded corners of
 * an opaque and a translucent fill, where no fill shows through the edge; and a layer blur and
 * both shadows at a negative radius, as a variable can give one, which draws like a radius of 0.
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
  addStripes(graph, pageId, 'Stripe', 620, 100)
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
  addStripes(graph, pageId, 'Union stripe', 260, 280)
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
  for (const [index, type] of (['LAYER_BLUR', 'DROP_SHADOW', 'INNER_SHADOW'] as const).entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Negative ${type.toLowerCase().replace('_', ' ')}`,
      x: 80 + index * 180,
      ...card,
      y: 460,
      fills: [solid(0.31, 0.27, 0.9)],
      effects: [effect(type, -6, type === 'LAYER_BLUR' ? 0 : 8)]
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

/** A grain effect at Figma's defaults with `params`, built as the scene graph holds it. */
function grain(type: 'NOISE' | 'TEXTURE', props: Partial<Effect>): Effect {
  return {
    type,
    radius: 4,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    ...props
  }
}

/**
 * Noise and texture effects on the canvas, in two rows: monotone, duotone, and multitone noise
 * and a larger monotone grain over a light fill, then textures over stripes, unclipped and clipped
 * to the shape.
 */
export function createGrainEffectsScene(graph: SceneGraph, pageId: string): void {
  const light = solid(0.92, 0.93, 0.96)
  const noises: Partial<Effect>[] = [
    { noise: { noiseType: 'MONOTONE', noiseSize: { x: 1, y: 1 }, density: 0.6 } },
    {
      color: { r: 0.9, g: 0.2, b: 0.3, a: 1 },
      noise: {
        noiseType: 'DUOTONE',
        noiseSize: { x: 1, y: 1 },
        density: 0.8,
        secondaryColor: { r: 0.2, g: 0.3, b: 0.9, a: 1 }
      }
    },
    {
      noise: { noiseType: 'MULTITONE', noiseSize: { x: 1, y: 1 }, density: 1, opacity: 0.8 }
    },
    { noise: { noiseType: 'MONOTONE', noiseSize: { x: 4, y: 4 }, density: 1 } }
  ]
  noises.forEach((props, index) => {
    graph.createNode('RECTANGLE', pageId, {
      name: `Noise ${index + 1}`,
      x: 80 + index * 180,
      y: 80,
      width: 140,
      height: 110,
      cornerRadius: 16,
      fills: [light],
      effects: [grain('NOISE', props)]
    })
  })
  for (const [index, clipToShape] of [false, true].entries()) {
    const x = 80 + index * 360
    addStripes(graph, pageId, `Under texture ${index + 1}`, x, 240)
    graph.createNode('RECTANGLE', pageId, {
      name: clipToShape ? 'Texture clipped' : 'Texture',
      x: x + 20,
      y: 260,
      width: 80,
      height: 80,
      cornerRadius: 12,
      fills: [solid(0.1, 0.12, 0.2)],
      effects: [
        grain('TEXTURE', { radius: 6, texture: { noiseSize: { x: 3, y: 3 }, clipToShape } })
      ]
    })
  }
  addCoverageNoises(graph, pageId)
}

/**
 * Noise over what layers draw, as Figma grains it: a 30% fill at 30% over stripes, a stroke
 * outside the fill, nothing at all on a layer with no fill, and a frame's children, not its gaps.
 */
function addCoverageNoises(graph: SceneGraph, pageId: string): void {
  const red = grain('NOISE', {
    color: { r: 1, g: 0, b: 0, a: 1 },
    noise: { noiseType: 'MONOTONE', noiseSize: { x: 1, y: 1 }, density: 1 }
  })
  addStripes(graph, pageId, 'Under translucent noise', 80, 420)
  graph.createNode('RECTANGLE', pageId, {
    name: 'Translucent noise',
    x: 90,
    y: 440,
    width: 100,
    height: 80,
    fills: [solid(1, 1, 1, 0.3)],
    effects: [red]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Stroked noise',
    x: 300,
    y: 450,
    width: 80,
    height: 60,
    fills: [solid(1, 1, 1)],
    strokes: [{ ...solid(0.2, 0.3, 0.9), weight: 12, align: 'OUTSIDE' }],
    strokeWeight: 12,
    strokeAlign: 'OUTSIDE',
    effects: [red]
  })
  addStripes(graph, pageId, 'Under unfilled noise', 460, 420)
  graph.createNode('RECTANGLE', pageId, {
    name: 'Unfilled noise',
    x: 470,
    y: 440,
    width: 100,
    height: 80,
    fills: [],
    effects: [red]
  })
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Frame noise',
    x: 640,
    y: 420,
    width: 160,
    height: 120,
    fills: [],
    clipsContent: false,
    effects: [red]
  })
  for (const x of [0, 100]) {
    graph.createNode('RECTANGLE', frame.id, {
      name: `Frame noise child ${x}`,
      x,
      y: 0,
      width: 60,
      height: 120,
      fills: [solid(1, 1, 1)]
    })
  }
}
