import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderText } from '#core/canvas/scene'
import type { SceneNode } from '#core/scene-graph'

import { createMockPaint, createMockRenderer, createSaveTrackingCanvas } from './helpers'

describe('renderText frees Paragraph on drawParagraph exception', () => {
  test('Paragraph is deleted when drawParagraph throws', () => {
    let paragraphFreed = false

    const paragraph = {
      delete: () => {
        paragraphFreed = true
      },
      layout: mock(() => undefined),
      getLongestLine: mock(() => 100),
      getHeight: mock(() => 20),
      getShapedLines: mock(() => []),
      getLineMetrics: mock(() => [])
    }

    const { canvas, getSaveDepth } = createSaveTrackingCanvas({
      drawParagraph: () => {
        throw new Error('Simulated drawParagraph failure')
      }
    })

    const renderer = createMockRenderer({
      fontsLoaded: true,
      fontProvider: {},
      fillPaint: {
        ...createMockPaint(),
        getColor: () => new Float32Array([0, 0, 0, 1])
      } as SkiaRenderer['fillPaint'],
      effectLayerPaint: {
        ...createMockPaint(),
        setBlendMode: mock(() => undefined)
      } as SkiaRenderer['effectLayerPaint'],
      buildParagraph: () => paragraph
    })

    const node = {
      id: 'text-1',
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
      effects: [],
      childIds: [],
      text: 'Hello World',
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      textAlignHorizontal: 'LEFT',
      textAutoResize: 'NONE',
      rotation: 0,
      flipX: false,
      flipY: false,
      cornerRadius: 0
    } as SceneNode

    const depthBefore = getSaveDepth()

    expect(() => {
      renderText(renderer, canvas as never, node, node.fills[0])
    }).toThrow('Simulated drawParagraph failure')

    expect(paragraphFreed).toBe(true)
    expect(getSaveDepth()).toBe(depthBefore)
  })
})

describe('drawGradientText save/restore balance on exception', () => {
  test('Paragraph is freed and canvas save stack is balanced when drawParagraph throws in gradient text path', () => {
    let paragraphFreed = false

    const paragraph = {
      delete: () => {
        paragraphFreed = true
      },
      layout: mock(() => undefined),
      getLongestLine: mock(() => 100),
      getHeight: mock(() => 20)
    }

    const { canvas, getSaveDepth } = createSaveTrackingCanvas({
      drawParagraph: () => {
        throw new Error('Simulated drawParagraph failure')
      }
    })

    const renderer = createMockRenderer({
      fontsLoaded: true,
      fontProvider: {},
      buildParagraph: () => paragraph,
      isNodeFontLoaded: () => true
    })

    const gradientFill = {
      type: 'GRADIENT_LINEAR' as const,
      visible: true,
      opacity: 1,
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }

    const node = {
      id: 'gradient-text-1',
      type: 'TEXT',
      width: 200,
      height: 24,
      text: 'Gradient Text',
      textAutoResize: 'HEIGHT',
      fills: [gradientFill]
    } as Parameters<typeof renderText>[2]

    const depthBefore = getSaveDepth()

    expect(() => {
      renderText(renderer, canvas as never, node, gradientFill as never, true)
    }).toThrow('Simulated drawParagraph failure')

    expect(paragraphFreed).toBe(true)
    expect(getSaveDepth()).toBe(depthBefore)
  })
})
