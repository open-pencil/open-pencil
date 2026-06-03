import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { drawLayoutGrids } from '#core/canvas/layout-grids'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

function nodeWithLayoutGrids(layoutGrids: unknown[]): SceneNode {
  return {
    type: 'FRAME',
    width: 240,
    height: 160,
    source: {
      fig: {
        rawNodeFields: { layoutGrids }
      }
    }
  } as SceneNode
}

describe('layout grid rendering', () => {
  test('renders Figma plugin column grids', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = nodeWithLayoutGrids([
      {
        pattern: 'COLUMNS',
        visible: true,
        color: { r: 1, g: 0, b: 0, a: 0.1 },
        sectionSize: 48,
        gutterSize: 16,
        alignment: 'MIN',
        count: 4,
        offset: 16
      }
    ])

    drawLayoutGrids(r, canvas as Canvas, node)

    expect(mockCalls(canvas.drawRect)).toHaveLength(4)
    expect(mockCalls(r.ck.LTRBRect)[0]).toEqual([16, 0, 64, 160])
    expect(mockCalls(r.ck.LTRBRect)[3]).toEqual([208, 0, 256, 160])
  })

  test('renders stretched column grids', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = nodeWithLayoutGrids([
      {
        pattern: 'COLUMNS',
        visible: true,
        color: { r: 1, g: 0, b: 0, a: 0.1 },
        gutterSize: 10,
        alignment: 'STRETCH',
        count: 3,
        offset: 15
      }
    ])

    drawLayoutGrids(r, canvas as Canvas, node)

    expect(mockCalls(canvas.drawRect)).toHaveLength(3)
    expect(mockCalls(r.ck.LTRBRect)).toEqual([
      [15, 0, 78.33333333333334, 160],
      [88.33333333333334, 0, 151.66666666666669, 160],
      [161.66666666666669, 0, 225.00000000000003, 160]
    ])
  })

  test('renders Kiwi row grids', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = nodeWithLayoutGrids([
      {
        pattern: 'STRIPES',
        axis: 'Y',
        visible: true,
        color: { r: 0, g: 0, b: 1, a: 0.2 },
        sectionSize: 20,
        gutterSize: 10,
        type: 'MIN',
        numSections: 2,
        offset: 5
      }
    ])

    drawLayoutGrids(r, canvas as Canvas, node)

    expect(mockCalls(canvas.drawRect)).toHaveLength(2)
    expect(mockCalls(r.ck.LTRBRect)).toEqual([
      [0, 5, 240, 25],
      [0, 35, 240, 55]
    ])
  })

  test('skips malformed square grids', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = nodeWithLayoutGrids([{ pattern: 'GRID', alignment: 'STRETCH', sectionSize: 0 }])

    drawLayoutGrids(r, canvas as Canvas, node)

    expect(canvas.drawRect).not.toHaveBeenCalled()
  })

  test('skips hidden grids', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = nodeWithLayoutGrids([{ visible: false, sectionSize: 20, count: 2 }])

    drawLayoutGrids(r, canvas as Canvas, node)

    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
