import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderText } from '#core/canvas/scene'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockPaint, createMockRenderer } from './helpers'

describe('text LOD draws gray rect for non-SOLID first fill', () => {
  test('LOD box is drawn when the first visible fill fails applyFill (IMAGE fallback)', () => {
    let drawRectCalled = false
    const canvas = createMockCanvas({
      drawRect: () => {
        drawRectCalled = true
      }
    })

    const node = {
      id: 'text-lod-vanish-1',
      type: 'TEXT',
      width: 200,
      height: 24,
      x: 0,
      y: 0,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'unloaded-image',
          visible: true,
          opacity: 1,
          imageScaleMode: 'FILL'
        },
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 0.8 }
      ],
      strokes: [],
      effects: [],
      childIds: [],
      text: 'Vanishing Text',
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

    const renderer = createMockRenderer({
      ck: {
        Color4f: () => [0.5, 0.5, 0.5, 1],
        LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
        MakePicture: () => null
      } as SkiaRenderer['ck'],
      fillPaint: {
        ...createMockPaint(),
        getColor: () => new Float32Array([0, 0, 0, 1])
      } as SkiaRenderer['fillPaint'],
      _currentAbsInfo: {
        width: 200,
        height: 24,
        boundX: 0,
        boundY: 0,
        x: 0,
        y: 0,
        rotation: 0,
        centerX: 100,
        centerY: 12
      },
      zoom: 0.1,
      minScreenSizeForText: 100,
      fontsLoaded: true,
      fontProvider: {},
      _textLodCulledCount: 0,
      buildParagraph: () => ({
        delete: mock(() => undefined),
        layout: mock(() => undefined),
        getLongestLine: mock(() => 100),
        getHeight: mock(() => 20)
      }),
      isNodeFontLoaded: () => true
    })

    renderText(renderer, canvas as never, node, node.fills[1], true)

    expect(drawRectCalled).toBe(true)
    expect(renderer._textLodCulledCount).toBeGreaterThan(0)
  })
})

describe('text LOD multiplies fill color alpha with opacity', () => {
  test('effective alpha is color.a × fill.opacity (no setAlphaf replace)', () => {
    let color4fArgs: Float32Array | null = null
    let setAlphafCount = 0
    const canvas = createMockCanvas()

    const node = {
      id: 'text-alpha-1',
      type: 'TEXT',
      width: 200,
      height: 24,
      x: 0,
      y: 0,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 0.5 },
          visible: true,
          opacity: 0.5
        }
      ],
      strokes: [],
      effects: [],
      childIds: [],
      text: 'Alpha Test',
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

    const renderer = createMockRenderer({
      ck: {
        Color4f: (r: number, g: number, b: number, a: number) => {
          const arr = new Float32Array([r, g, b, a])
          color4fArgs = arr
          return arr
        },
        LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
        MakePicture: () => null
      } as SkiaRenderer['ck'],
      auxFill: {
        ...createMockPaint(),
        setColor: (color: Float32Array) => {
          color4fArgs = color
        },
        setAlphaf: () => {
          setAlphafCount++
        }
      } as SkiaRenderer['auxFill'],
      fillPaint: {
        ...createMockPaint(),
        getColor: () => new Float32Array([1, 0, 0, 0.5])
      } as SkiaRenderer['fillPaint'],
      _currentAbsInfo: {
        width: 200,
        height: 24,
        boundX: 0,
        boundY: 0,
        x: 0,
        y: 0,
        rotation: 0,
        centerX: 100,
        centerY: 12
      },
      zoom: 0.1,
      minScreenSizeForText: 100,
      fontsLoaded: true,
      fontProvider: {},
      _textLodCulledCount: 0,
      buildParagraph: () => ({
        delete: mock(() => undefined),
        layout: mock(() => undefined),
        getLongestLine: mock(() => 100),
        getHeight: mock(() => 20)
      }),
      isNodeFontLoaded: () => true
    })

    renderText(renderer, canvas as never, node, node.fills[0], true)

    expect(color4fArgs?.[3]).toBe(0.25)
    expect(setAlphafCount).toBe(0)
  })
})
