import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/core'

import { renderShape } from '#core/canvas/scene'
import { createGraphEventSubscription } from '#core/editor/graph-events'

import { createMockCanvas, createMockRenderer } from '../renderer/effects/helpers'

function makeShadowFrameGraph() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    name: 'Shadow frame',
    width: 100,
    height: 100,
    fills: [],
    effects: [
      {
        type: 'DROP_SHADOW',
        visible: true,
        radius: 8,
        offset: { x: 4, y: 4 },
        color: { r: 0, g: 0, b: 0, a: 0.3 },
        blendMode: 'NORMAL',
        spread: 0
      }
    ]
  })
  const childA = graph.createNode('RECTANGLE', frame.id, {
    name: 'A',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
  })
  const childB = graph.createNode('RECTANGLE', frame.id, {
    name: 'B',
    x: 40,
    y: 0,
    width: 20,
    height: 20,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })
  return { graph, frame, childA, childB }
}

function createCachingRenderer() {
  const pictures = new Map<string, { delete(): void }>()
  let uncachedCalls = 0
  const recorder = {
    beginRecording: mock(() => createMockCanvas()),
    finishRecordingAsPicture: mock(() => ({ delete: mock(() => undefined) })),
    delete: mock(() => undefined)
  }

  const renderer = createMockRenderer({
    minScreenSizeForEffects: 0,
    effectOverflow: (_node: SceneNode) => 12,
    renderShapeUncached: mock(() => {
      uncachedCalls++
    }),
    nodePictureCache: {
      get: (id: string) => pictures.get(id) ?? null,
      set: (id: string, value: { delete(): void }) => {
        pictures.set(id, value)
      }
    }
  }) as ReturnType<typeof createMockRenderer> & {
    ck: ReturnType<typeof createMockRenderer>['ck'] & {
      PictureRecorder: new () => typeof recorder
    }
    effectOverflow: (_node: SceneNode) => number
    renderShapeUncached: (_canvas: unknown, _node: SceneNode, _graph: SceneGraph) => void
    invalidateNodePicture: (nodeId: string) => void
    invalidateAllPictures: () => void
    invalidateVectorPath: (_nodeId: string) => void
  }

  renderer.ck = {
    ...renderer.ck,
    PictureRecorder: class {
      beginRecording = recorder.beginRecording
      finishRecordingAsPicture = recorder.finishRecordingAsPicture
      delete = recorder.delete
    }
  }
  renderer.invalidateNodePicture = (nodeId: string) => {
    pictures.delete(nodeId)
  }
  renderer.invalidateAllPictures = () => {
    pictures.clear()
  }
  renderer.invalidateVectorPath = (_nodeId: string) => undefined

  return { renderer, pictures, getUncachedCalls: () => uncachedCalls }
}

describe('graph event renderer invalidation', () => {
  test('child updates invalidate ancestor effect pictures that depend on children', () => {
    const { graph, frame, childA } = makeShadowFrameGraph()
    const { renderer, pictures, getUncachedCalls } = createCachingRenderer()
    createGraphEventSubscription({
      getGraph: () => graph,
      getRenderers: () => [renderer],
      scheduleComponentSync: () => undefined,
      requestRender: () => undefined,
      emitEditorEvent: () => undefined
    }).subscribeToGraph()

    renderShape(renderer as never, createMockCanvas() as never, frame, graph)
    expect(getUncachedCalls()).toBe(1)
    expect(pictures.has(frame.id)).toBe(true)

    graph.updateNode(childA.id, { x: 12 })

    renderShape(renderer as never, createMockCanvas() as never, frame, graph)
    expect(getUncachedCalls()).toBe(2)
  })

  test('child reorder invalidates ancestor effect pictures that depend on child order', () => {
    const { graph, frame, childB } = makeShadowFrameGraph()
    const { renderer, pictures, getUncachedCalls } = createCachingRenderer()
    createGraphEventSubscription({
      getGraph: () => graph,
      getRenderers: () => [renderer],
      scheduleComponentSync: () => undefined,
      requestRender: () => undefined,
      emitEditorEvent: () => undefined
    }).subscribeToGraph()

    renderShape(renderer as never, createMockCanvas() as never, frame, graph)
    expect(getUncachedCalls()).toBe(1)
    expect(pictures.has(frame.id)).toBe(true)

    graph.reorderChild(childB.id, frame.id, 0)

    renderShape(renderer as never, createMockCanvas() as never, frame, graph)
    expect(getUncachedCalls()).toBe(2)
  })
})
