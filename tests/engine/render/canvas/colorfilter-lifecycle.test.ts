import { describe, expect, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockRenderer, createSaveTrackingCanvas } from './helpers'

describe('drawTextInnerShadow frees ColorFilters on exception', () => {
  test('ColorFilters are deleted when renderText throws inside drawTextInnerShadow', () => {
    const filters: Array<{ name: string; freed: boolean }> = []
    let filterCallIndex = 0

    const mockMakeBlend = () => {
      const name = filterCallIndex === 0 ? 'tintFilter' : 'solidBlackFilter'
      filterCallIndex++
      const entry = { name, freed: false }
      filters.push(entry)
      return {
        delete: () => {
          entry.freed = true
        }
      }
    }

    let renderTextCall = 0
    const { canvas, getSaveDepth } = createSaveTrackingCanvas()

    const renderer = createMockRenderer({
      ck: {
        Color4f: () => [0, 0, 0, 1],
        BlendMode: { SrcOver: 'SrcOver', SrcIn: 'SrcIn', DstOut: 'DstOut' },
        ColorFilter: { MakeBlend: mockMakeBlend },
        LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b]
      } as SkiaRenderer['ck'],
      color4f: () => [0, 0, 0, 1],
      getCachedDecalBlur: () => null,
      renderText: () => {
        renderTextCall++
        if (renderTextCall >= 2) throw new Error('Simulated CK error during text layout')
      }
    })

    const textNode = {
      id: 'text-shadow-1',
      type: 'TEXT',
      width: 100,
      height: 24,
      x: 0,
      y: 0,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }],
      strokes: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 1 },
          radius: 2,
          spread: 0
        }
      ],
      childIds: [],
      text: 'Hello',
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      textAlignHorizontal: 'LEFT',
      textAutoResize: 'NONE',
      rotation: 0,
      flipX: false,
      flipY: false,
      cornerRadius: 0,
      strokeGeometry: []
    } as SceneNode

    const rect = new Float32Array([0, 0, 100, 24])
    const depthBefore = getSaveDepth()

    expect(() => {
      renderEffects(renderer, canvas as never, textNode, rect, false, 'front', null)
    }).toThrow('Simulated CK error during text layout')

    expect(filters.length).toBe(2)
    expect(filters[0].freed).toBe(true)
    expect(filters[1].freed).toBe(true)
    expect(getSaveDepth()).toBe(depthBefore)
  })
})
