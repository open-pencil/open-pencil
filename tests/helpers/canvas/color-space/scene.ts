import type { BlendMode, SceneGraph } from '@open-pencil/scene-graph'

import { linearGradient, solid } from '../paints'

const BLENDS: BlendMode[] = ['MULTIPLY', 'SCREEN', 'OVERLAY', 'COLOR_DODGE', 'HUE', 'LUMINOSITY']

/**
 * Saturated paints at the edge of sRGB, blended over three backdrops and seen through a
 * luminance mask, in one frame. In a Display P3 document these are the colours whose blends and
 * masks would drift if the surface were drawn or composited in the wrong space.
 */
export function createWideGamutScene(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Wide gamut paints',
    x: 0,
    y: 0,
    width: 560,
    height: 360,
    fills: [solid(1, 1, 1)]
  })
  const backdrops = [solid(1, 0, 0), solid(0, 1, 0), solid(0, 0, 1)]
  for (const [index, fill] of backdrops.entries()) {
    graph.createNode('RECTANGLE', frame.id, {
      name: `Backdrop ${index + 1}`,
      x: 20 + index * 120,
      y: 20,
      width: 120,
      height: 320,
      fills: [fill]
    })
  }
  for (const [index, blendMode] of BLENDS.entries()) {
    graph.createNode('ELLIPSE', frame.id, {
      name: `${blendMode} circle`,
      x: 40 + (index % 3) * 100,
      y: 40 + Math.floor(index / 3) * 150,
      width: 120,
      height: 120,
      blendMode,
      fills: [solid(1, 0.85, 0)]
    })
  }

  const masked = graph.createNode('FRAME', frame.id, {
    name: 'Luminance mask',
    x: 400,
    y: 20,
    width: 140,
    height: 320,
    fills: []
  })
  graph.createNode('RECTANGLE', masked.id, {
    name: 'Mask gradient',
    x: 0,
    y: 0,
    width: 140,
    height: 320,
    isMask: true,
    maskType: 'LUMINANCE',
    // Top to bottom.
    fills: [
      linearGradient(
        [
          { r: 0, g: 0, b: 0, a: 1 },
          { r: 1, g: 1, b: 1, a: 1 }
        ],
        { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
      )
    ]
  })
  for (const [index, fill] of [solid(1, 0, 0.5), solid(0, 1, 1)].entries()) {
    graph.createNode('RECTANGLE', masked.id, {
      name: `Masked stripe ${index + 1}`,
      x: index * 70,
      y: 0,
      width: 70,
      height: 320,
      fills: [fill]
    })
  }
  return { frameId: frame.id }
}

/**
 * A Display P3 document's paints where the profile shows: text, a gradient fill and a gradient
 * stroke, a shadow, seeded noise and texture, and blend modes, all in colors outside sRGB.
 */
export function createP3RenderingScene(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'P3 rendering',
    x: 0,
    y: 0,
    width: 520,
    height: 300,
    fills: [solid(1, 1, 1)]
  })
  const shadow = {
    type: 'DROP_SHADOW' as const,
    color: { r: 0, g: 0.4, b: 1, a: 0.6 },
    offset: { x: 0, y: 6 },
    radius: 10,
    spread: 0,
    visible: true
  }
  graph.createNode('TEXT', frame.id, {
    name: 'P3 text',
    x: 20,
    y: 16,
    width: 300,
    height: 60,
    text: 'Vivid',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 700,
    textAutoResize: 'NONE',
    fills: [solid(1, 0, 0)]
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Gradient with stroke and shadow',
    x: 20,
    y: 100,
    width: 200,
    height: 80,
    cornerRadius: 12,
    fills: [
      linearGradient([
        { r: 1, g: 0, b: 0, a: 1 },
        { r: 0, g: 1, b: 0, a: 1 }
      ])
    ],
    strokes: [
      {
        ...linearGradient([
          { r: 0, g: 0, b: 1, a: 1 },
          { r: 1, g: 0, b: 1, a: 1 }
        ]),
        weight: 6,
        align: 'INSIDE'
      }
    ],
    effects: [shadow]
  })
  const base = { offset: { x: 0, y: 0 }, spread: 0, visible: true }
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Noise',
    x: 240,
    y: 100,
    width: 120,
    height: 80,
    fills: [solid(0, 0.8, 0.5)],
    effects: [
      {
        ...base,
        type: 'NOISE',
        color: { r: 1, g: 0, b: 0, a: 1 },
        radius: 0,
        noise: { noiseType: 'MONOTONE', noiseSize: { x: 2, y: 2 }, density: 0.5, seed: 7 }
      }
    ]
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Texture',
    x: 380,
    y: 100,
    width: 120,
    height: 80,
    fills: [solid(1, 0.5, 0)],
    effects: [
      {
        ...base,
        type: 'TEXTURE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        radius: 6,
        texture: { noiseSize: { x: 4, y: 4 }, clipToShape: true, seed: 3 }
      }
    ]
  })
  for (const [index, blendMode] of BLENDS.entries()) {
    graph.createNode('RECTANGLE', frame.id, {
      name: `Backdrop ${blendMode}`,
      x: 20 + index * 80,
      y: 210,
      width: 70,
      height: 70,
      fills: [solid(0.3, 0.6, 0.7)]
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: blendMode,
      x: 40 + index * 80,
      y: 230,
      width: 50,
      height: 50,
      blendMode,
      fills: [solid(0.8, 0.4, 0.3)]
    })
  }
  return { frameId: frame.id }
}
