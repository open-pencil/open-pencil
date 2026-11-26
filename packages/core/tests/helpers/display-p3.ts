import type { BlendMode, SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

type RGB = Omit<Color, 'a'>

/**
 * Live-measured in Figma: a file with a Display P3 profile, one layer in each mode over its
 * backdrop, exported as PNG. Colors and results are the file's own P3 components, the results in
 * 8 bits. Every mode matches its formula on those components, not on their sRGB equivalents.
 */
export const P3_BLENDS: ReadonlyArray<{
  source: RGB
  backdrop: RGB
  modes: ReadonlyArray<[BlendMode, [number, number, number]]>
}> = [
  {
    source: { r: 0.8, g: 0.4, b: 0.3 },
    backdrop: { r: 0.3, g: 0.6, b: 0.7 },
    modes: [
      ['NORMAL', [204, 102, 77]],
      ['MULTIPLY', [62, 61, 54]],
      ['SCREEN', [219, 194, 201]],
      ['OVERLAY', [123, 133, 148]],
      ['COLOR_BURN', [33, 0, 0]]
    ]
  },
  {
    source: { r: 0.2, g: 0.7, b: 0.9 },
    backdrop: { r: 0.15, g: 0.35, b: 0.8 },
    modes: [
      ['NORMAL', [51, 178, 229]],
      ['MULTIPLY', [8, 62, 183]],
      ['SCREEN', [81, 205, 250]],
      ['OVERLAY', [15, 124, 245]],
      ['COLOR_BURN', [0, 17, 198]]
    ]
  }
]

export const P3_CELL = 10

export interface P3BlendCell {
  /** The cell's centre on the page. */
  x: number
  y: number
  expected: [number, number, number]
}

/** Lays {@link P3_BLENDS} out on a page as cells of `P3_CELL`, one row per pair, and returns them. */
export function buildP3BlendCells(graph: SceneGraph, parentId: string): P3BlendCell[] {
  const cells: P3BlendCell[] = []
  for (const [row, { source, backdrop, modes }] of P3_BLENDS.entries()) {
    for (const [column, [mode, expected]] of modes.entries()) {
      const box = { x: column * P3_CELL, y: row * P3_CELL, width: P3_CELL, height: P3_CELL }
      const fill = (color: RGB) => ({
        type: 'SOLID' as const,
        color: { ...color, a: 1 },
        opacity: 1,
        visible: true
      })
      graph.createNode('RECTANGLE', parentId, { ...box, fills: [fill(backdrop)] })
      graph.createNode('RECTANGLE', parentId, {
        ...box,
        fills: [fill(source)],
        blendMode: mode
      })
      cells.push({ x: box.x + P3_CELL / 2, y: box.y + P3_CELL / 2, expected })
    }
  }
  return cells
}
