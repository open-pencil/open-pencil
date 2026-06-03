import { describe, expect, mock, test } from 'bun:test'

import { applyFill } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { SceneGraph } from '#core/scene-graph'
import type { Fill, SceneNode } from '#core/scene-graph'

function createRenderer() {
  const picture = {
    makeShader: mock(() => 'pattern-shader'),
    delete: mock(() => undefined)
  }
  const recorder = {
    beginRecording: mock(() => ({
      drawRect: mock(() => undefined),
      drawRRect: mock(() => undefined),
      restore: mock(() => undefined),
      save: mock(() => undefined),
      scale: mock(() => undefined),
      translate: mock(() => undefined)
    })),
    finishRecordingAsPicture: mock(() => picture),
    delete: mock(() => undefined)
  }

  return {
    fillPaint: {
      setShader: mock(() => undefined),
      setColor: mock(() => undefined)
    },
    ck: {
      Color4f: mock((r, g, b, a) => ['color', r, g, b, a]),
      FilterMode: { Linear: 'linear' },
      LTRBRect: mock((left, top, right, bottom) => [left, top, right, bottom]),
      PictureRecorder: mock(() => recorder),
      TileMode: { Repeat: 'repeat' }
    },
    resolveFillColor: mock((fill: Fill) => fill.color),
    makeRRect: mock(() => 'rrect')
  } as SkiaRenderer
}

const node = { id: '1:2', source: { id: '' }, width: 100, height: 100 } as SceneNode

describe('schema fill fallback rendering', () => {
  test('renders pattern fills from referenced source nodes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = graph.createNode('RECTANGLE', page.id, {
      width: 10,
      height: 10,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    source.source.id = '12:34'
    const renderer = createRenderer()
    const fill: Fill = {
      type: 'PATTERN',
      sourceNodeId: '12:34',
      patternSpacing: { x: 0.25, y: 0.4 },
      color: { r: 0.2, g: 0.3, b: 0.4, a: 0.8 },
      opacity: 1,
      visible: true
    }

    expect(applyFill(renderer, fill, node, graph)).toBe(true)
    expect(renderer.fillPaint.setShader).toHaveBeenLastCalledWith('pattern-shader')
    expect(renderer.fillPaint.setColor).not.toHaveBeenCalledWith(['color', 0.2, 0.3, 0.4, 0.8])
  })

  test.each(['PATTERN', 'NOISE', 'CUSTOM'] as const)(
    'renders %s fills as solid fallback',
    (type) => {
      const renderer = createRenderer()
      const fill: Fill = {
        type,
        color: { r: 0.2, g: 0.3, b: 0.4, a: 0.8 },
        opacity: 1,
        visible: true
      }

      expect(applyFill(renderer, fill, node, new SceneGraph())).toBe(true)
      expect(renderer.fillPaint.setColor).toHaveBeenCalledWith(['color', 0.2, 0.3, 0.4, 0.8])
    }
  )
})
