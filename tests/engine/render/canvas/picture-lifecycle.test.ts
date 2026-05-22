import { describe, expect, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderText } from '#core/canvas/scene'
import type { SceneNode } from '#core/scene-graph'

import { createMockRenderer, createSaveTrackingCanvas } from './helpers'

describe('renderText frees Picture on drawPicture exception', () => {
  test('Picture is deleted when drawPicture throws', () => {
    let pictureFreed = false
    const { canvas, getSaveDepth } = createSaveTrackingCanvas({
      drawPicture: () => {
        throw new Error('Simulated drawPicture failure')
      }
    })

    const renderer = createMockRenderer({
      ck: {
        Color4f: () => new Float32Array([0, 0, 0, 1]),
        BlendMode: { SrcOver: 'SrcOver' },
        ClipOp: { Intersect: 'Intersect' },
        MakePicture: () => ({
          delete: () => {
            pictureFreed = true
          }
        }),
        LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b]
      } as SkiaRenderer['ck'],
      fontsLoaded: false,
      fontProvider: null,
      minScreenSizeForText: 0,
      buildParagraph: () => undefined
    })

    const node = {
      id: 'text-pic-1',
      type: 'TEXT',
      width: 200,
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
      text: 'Hello',
      textPicture: new Uint8Array([0, 1, 2, 3]),
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
    }).toThrow('Simulated drawPicture failure')

    expect(pictureFreed).toBe(true)
    expect(getSaveDepth()).toBe(depthBefore)
  })
})
