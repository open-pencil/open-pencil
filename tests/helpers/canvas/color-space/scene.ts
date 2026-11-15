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
