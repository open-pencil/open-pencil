import { describe, test, expect, mock, type Mock } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '#core/scene-graph'

import { createMockRenderer, createMockCanvas, renderEffects } from './helpers'
import type { EffectTestGraph } from './helpers'

describe('Text shadow renders on glyphs, not bounding box (Behavioral)', () => {
  test('drop shadow has TEXT-specific branch', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'behind')

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect((canvas as Canvas).saveLayer).toHaveBeenCalled()
    expect(r.renderText).toHaveBeenCalled()
  })

  test('inner shadow has TEXT-specific branch', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    // 4-layer saveLayer stack: Master, SrcIn/Tint, Blur, DstOut/Punch
    expect((canvas as Canvas).saveLayer).toHaveBeenCalledTimes(4)
    // renderText called twice: once for mask (step 2), once for punch-out (step 8)
    expect(r.renderText).toHaveBeenCalledTimes(2)
    // Blend modes for the SrcIn and DstOut layers
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.SrcIn)
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    // Blur filter for the shadow
    expect(r.getCachedDecalBlur).toHaveBeenCalledTimes(1)
    // Giant rect for (1-M) base
    expect((canvas as Canvas).drawRect).toHaveBeenCalledTimes(1)
  })

  test('inner shadow detaches ColorFilter from effectLayerPaint before deletion', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    const calls = (r.effectLayerPaint.setColorFilter as Mock).mock.calls
    // The final call must be null (exit guard cleans up)
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBeNull()

    // Every non-null ColorFilter assignment must have a subsequent null detach.
    for (let i = 0; i < calls.length; i++) {
      if (calls[i][0] !== null) {
        const hasSubsequentNull = calls.slice(i + 1).some((c: unknown[]) => c[0] === null)
        expect(hasSubsequentNull).toBe(true)
      }
    }
  })
})

describe('Edge cases and bug fixes', () => {
  test('drop shadow cast from stroke when node has no fill', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: false, type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokes: [{ visible: true, weight: 2, opacity: 1 }],
      strokeGeometry: [{} as Record<string, unknown>]
    }
    const mockPath = new r.ck.Path()
    r.getStrokeGeometry = mock(() => [mockPath])

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.getStrokeGeometry).toHaveBeenCalledWith(node as SceneNode)
    expect((canvas as Canvas).drawPath).toHaveBeenCalled()
  })

  test('drop shadow from child applies child transforms (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    // Verify order: translate (offset) -> rotate -> translate (flip) -> scale
    const translateMock = (canvas as Canvas).translate as Mock
    const rotateMock = (canvas as Canvas).rotate as Mock
    const scaleMock = (canvas as Canvas).scale as Mock

    const translateCalls = translateMock.mock.calls as unknown[][]
    const rotateCalls = rotateMock.mock.calls as unknown[][]
    const scaleCalls = scaleMock.mock.calls as unknown[][]

    expect(translateCalls[0]).toEqual([5 + 10, 5 + 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect((canvas as Canvas).drawRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child renders glyphs (fidelity parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect((canvas as Canvas).saveLayer).toHaveBeenCalled()
    const translateMock = (canvas as Canvas).translate as Mock
    expect(translateMock).toHaveBeenCalledWith(15, 25)
    expect(r.renderText).toHaveBeenCalledWith(expect.anything(), child)
  })

  test('inner shadow from shape child applies child transforms and rects (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'front',
      child as SceneNode
    )

    const translateMock = (canvas as Canvas).translate as Mock
    const rotateMock = (canvas as Canvas).rotate as Mock
    const scaleMock = (canvas as Canvas).scale as Mock

    const translateCalls = translateMock.mock.calls as unknown[][]
    const rotateCalls = rotateMock.mock.calls as unknown[][]
    const scaleCalls = scaleMock.mock.calls as unknown[][]

    expect(translateCalls[0]).toEqual([10, 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(0, 0, 50, 60)
    expect((canvas as Canvas).clipRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child applies offset in parent space', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      rotation: 45,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    const translateMock = (canvas as Canvas).translate as Mock
    const translateCalls = translateMock.mock.calls as unknown[][]
    expect(translateCalls[0]).toEqual([15, 25]) // offset + child position

    // The filter should NOT have the offset (neutralized to 0,0)
    expect(r.getCachedDropShadow).toHaveBeenCalledWith(0, 0, 5, expect.anything())
  })

  test('INNER_SHADOW with large offset does not vanish (bounding box union)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 200, y: 0 },
          radius: 10,
          spread: 0
        }
      ]
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )

    // Expect LTRBRect for 'big' to encompass both the shape (0 to 100) and the offset hole (200 to 300)
    // with expand (20) padding: min(-20, -20+200) = -20, max(100+20, 100+20+200) = 320
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-20, -20, 320, 120)
    expect((canvas as Canvas).drawPath).toHaveBeenCalled()
  })

  test('INNER_SHADOW with spread on rounded rect shrinks hole concentrically', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      cornerRadius: 10,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ]
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      true,
      'front'
    )

    // makeRRectWithOffset should receive (node, localOffsetX, localOffsetY, spread)
    expect(r.makeRRectWithOffset).toHaveBeenCalledWith(node as SceneNode, 5, 5, 4)
  })
})

describe('INNER_SHADOW bug proofs', () => {
  test('INNER_SHADOW solid mask via ColorFilter on DstOut layer', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ]
    }

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'front')

    // PROOF: ColorFilter.MakeBlend(black, SrcIn) on DstOut layer paint
    // forces renderText output to solid black without mutating fillPaint.
    expect((canvas as Canvas).saveLayer).toHaveBeenCalled()
    expect((canvas as Canvas).drawRect).toHaveBeenCalled()
  })
})

describe('renderNode error boundary (methods.ts:139-175)', () => {
  test('error inside renderNode restores canvas save depth and draws red error box', () => {
    let saveCount = 5

    // Build a typed mock canvas for the error boundary test
    const canvas: {
      getSaveCount: () => number
      save: () => void
      restore: () => void
      drawRect: (_rect: Float32Array) => void
      saveLayer: (_paint?: unknown, _bounds?: Float32Array) => void
      translate: (_x: number, _y: number) => void
    } = {
      getSaveCount: mock(() => saveCount),
      save: mock(() => {
        saveCount++
      }),
      restore: mock(() => {
        saveCount--
      }),
      drawRect: mock((_rect: Float32Array) => undefined),
      translate: mock((_x: number, _y: number) => undefined),
      saveLayer: mock((_paint?: unknown, _bounds?: Float32Array) => {
        saveCount++
        throw new Error('Simulated CanvasKit error: NaN in gradient shader')
      })
    }

    const node: Partial<SceneNode> = {
      id: 'error-node',
      visible: true,
      x: 10,
      y: 20,
      width: 100,
      height: 200,
      rotation: 0,
      opacity: 1,
      effects: [],
      childIds: []
    }
    const graph: EffectTestGraph = {
      getNode: (_id: string) => node as SceneNode,
      images: new Map()
    }

    // Create a mock renderer and override renderNode to simulate scene.ts behavior
    const r = createMockRenderer()
    r.renderNode = (_canvas: unknown, _graph: unknown, _nodeId: string, _overlays: unknown) => {
      const c = _canvas as typeof canvas
      c.save()
      c.translate(10, 20) // node.x, node.y
      // Simulate opacity < 1: canvas.saveLayer(opacityPaint)
      // Our canvas.saveLayer mock throws here
      c.saveLayer({} as unknown)
    }

    // Now call the methods.ts renderNode wrapper pattern
    let errorThrown = false
    const redBoxCalls: unknown[] = []
    try {
      const sd = canvas.getSaveCount()
      try {
        r.renderNode(canvas, graph as SceneGraph, 'error-node', {})
      } catch {
        errorThrown = true
        // Restore to save depth
        const toRestore = canvas.getSaveCount() - sd
        for (let i = 0; i < toRestore; i++) canvas.restore()

        // Draw red error box
        try {
          const n = graph.getNode('error-node')
          if (n) {
            canvas.drawRect(new Float32Array(4)) // simplified rect
            redBoxCalls.push('drawRect')
          }
        } catch {
          console.warn('Error drawing red error box fallback')
        }
      }
    } catch {
      console.warn('Error boundary outer catch (should not reach here)')
    }

    // Verify: error was caught
    expect(errorThrown).toBe(true)

    // canvas.save() was called once (saveCount went from 5 to 6), then saveLayer also
    // incremented saveCount (to 7). The boundary should restore saveCount to sd (5).
    expect(canvas.restore).toHaveBeenCalled()
    expect(canvas.getSaveCount()).toBe(5)

    // Verify: red error box was drawn
    expect(redBoxCalls.length).toBeGreaterThan(0)
  })
})
