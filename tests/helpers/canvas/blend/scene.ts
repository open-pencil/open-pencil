import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { solid } from '../paints'

const LINEAR_MODES = ['LINEAR_BURN', 'LINEAR_DODGE'] as const

function addBackdrops(graph: SceneGraph, pageId: string): void {
  const colors = [solid(0.2, 0.45, 0.85), solid(0.55, 0.55, 0.55), solid(0.9, 0.6, 0.2)]
  for (const [index, fill] of colors.entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Backdrop ${index}`,
      x: 60 + index * 160,
      y: 60,
      width: 160,
      height: 320,
      fills: [fill]
    })
  }
}

export function createLinearBlendScene(graph: SceneGraph, pageId: string): void {
  addBackdrops(graph, pageId)
  const paint = solid(0.5, 0.35, 0.6)
  for (const [row, blendMode] of LINEAR_MODES.entries()) {
    const y = 90 + row * 150
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} layer`,
      x: 80,
      y,
      width: 420,
      height: 36,
      blendMode,
      fills: [paint]
    })
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} fill`,
      x: 80,
      y: y + 46,
      width: 420,
      height: 36,
      fills: [{ ...paint, blendMode }]
    })
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} stroke`,
      x: 92,
      y: y + 98,
      width: 396,
      height: 12,
      fills: [],
      strokes: [{ ...paint, weight: 12, align: 'OUTSIDE', blendMode }]
    })
    // A thin bar casting a blended shadow below it into the gap before the next row.
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} shadow`,
      x: 80,
      y: y + 124,
      width: 420,
      height: 6,
      fills: [paint],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { ...paint.color },
          offset: { x: 0, y: 10 },
          radius: 0,
          spread: 0,
          visible: true,
          blendMode,
          showShadowBehindNode: false
        }
      ]
    })
  }
}

type RGB = readonly [number, number, number]

/** Soft light swatches as Figma drew them (live-measured, #2134): backdrop, source and result. */
export const SOFT_LIGHT_SWATCHES: readonly { backdrop: RGB; source: RGB; figma: RGB }[] = [
  { backdrop: [20, 10, 5], source: [255, 0, 0], figma: [38, 0, 0] },
  { backdrop: [5, 20, 40], source: [0, 255, 0], figma: [0, 38, 0] },
  { backdrop: [40, 30, 10], source: [0, 0, 255], figma: [0, 0, 20] },
  { backdrop: [60, 20, 20], source: [255, 200, 100], figma: [106, 30, 11] },
  { backdrop: [10, 60, 30], source: [100, 200, 255], figma: [4, 86, 56] },
  { backdrop: [100, 80, 60], source: [180, 60, 200], figma: [125, 47, 86] },
  { backdrop: [30, 90, 160], source: [128, 128, 128], figma: [30, 90, 160] },
  { backdrop: [200, 150, 60], source: [230, 230, 230], figma: [235, 200, 97] }
]

const SWATCH = 60

/** Each swatch's backdrop with a soft light layer over it, in a row; returns their centres. */
export function createSoftLightScene(graph: SceneGraph, pageId: string): Vector[] {
  const rgb = ([r, g, b]: RGB) => solid(r / 255, g / 255, b / 255)
  return SOFT_LIGHT_SWATCHES.map(({ backdrop, source }, index) => {
    const x = 60 + index * SWATCH
    graph.createNode('RECTANGLE', pageId, {
      name: `Backdrop ${index}`,
      x,
      y: 60,
      width: SWATCH,
      height: SWATCH,
      fills: [rgb(backdrop)]
    })
    graph.createNode('RECTANGLE', pageId, {
      name: `Soft light ${index}`,
      x,
      y: 60,
      width: SWATCH,
      height: SWATCH,
      blendMode: 'SOFT_LIGHT',
      fills: [rgb(source)]
    })
    return { x: x + SWATCH / 2, y: 60 + SWATCH / 2 }
  })
}

/**
 * A pass-through frame over a 50% grey backdrop, holding a grey layer that blends, as Figma drew
 * it (live-measured): the layer's grey, its blend mode, the frame's opacity, and the result.
 */
export const PASS_THROUGH_SWATCHES: readonly {
  grey: number
  blendMode: 'MULTIPLY' | 'SCREEN'
  opacity: number
  figma: number
}[] = [
  { grey: 0.4, blendMode: 'MULTIPLY', opacity: 0.5, figma: 90 },
  { grey: 0.4, blendMode: 'MULTIPLY', opacity: 0.7, figma: 75 },
  { grey: 0.6, blendMode: 'SCREEN', opacity: 0.5, figma: 166 },
  { grey: 0.6, blendMode: 'SCREEN', opacity: 0.7, figma: 181 }
]

/** Each swatch's backdrop and pass-through frame, in a row; returns their centres. */
export function createPassThroughScene(graph: SceneGraph, pageId: string): Vector[] {
  return PASS_THROUGH_SWATCHES.map(({ grey, blendMode, opacity }, index) => {
    const x = 60 + index * SWATCH
    graph.createNode('RECTANGLE', pageId, {
      name: `Backdrop ${index}`,
      x,
      y: 60,
      width: SWATCH,
      height: SWATCH,
      fills: [solid(0.5, 0.5, 0.5)]
    })
    const frame = graph.createNode('FRAME', pageId, {
      name: `Pass-through ${index}`,
      x,
      y: 60,
      width: SWATCH,
      height: SWATCH,
      fills: [],
      blendMode: 'PASS_THROUGH',
      opacity
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: `${blendMode} ${index}`,
      width: SWATCH,
      height: SWATCH,
      blendMode,
      fills: [solid(grey, grey, grey)]
    })
    return { x: x + SWATCH / 2, y: 60 + SWATCH / 2 }
  })
}
