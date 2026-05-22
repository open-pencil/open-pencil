import { describe, expect, mock, test } from 'bun:test'

import { applyFill, applyImageFill } from '#core/canvas/fills'
import { renderShapeUncached } from '#core/canvas/scene'
import type { ImageFill, SceneGraph, SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockGraph, createMockLRU, createMockRenderer } from './helpers'

function createImageShaderFixture() {
  const shaderDelete = mock(() => undefined)
  const shader = { delete: shaderDelete }
  const image = {
    width: mock(() => 24),
    height: mock(() => 24),
    makeShaderCubic: mock(() => shader),
    makeShaderOptions: mock(() => shader)
  }
  const renderer = createMockRenderer({
    imageCache: {
      ...createMockLRU(),
      get: mock(() => image)
    } as never,
    ck: {
      ...createMockRenderer().ck,
      Matrix: {
        scaled: mock(() => ({ kind: 'scaled' })),
        translated: mock(() => ({ kind: 'translated' })),
        multiply: mock(() => ({ kind: 'matrix' }))
      }
    } as never
  })
  renderer.applyImageFill = ((fill, node, graph) =>
    applyImageFill(renderer as never, fill, node, graph)) as never
  return { renderer, shaderDelete, shader, image }
}

function createImageFillNode(scaleMode: ImageFill['imageScaleMode']): SceneNode {
  return {
    id: 'image-fill-node',
    type: 'RECTANGLE',
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    visible: true,
    locked: false,
    opacity: 1,
    fills: [
      {
        type: 'IMAGE',
        visible: true,
        opacity: 1,
        imageHash: 'image-hash',
        imageScaleMode: scaleMode
      }
    ],
    strokes: [],
    effects: [],
    childIds: [],
    rotation: 0,
    flipX: false,
    flipY: false,
    cornerRadius: 0
  } as SceneNode
}

describe('image fill shader lifecycle', () => {
  test.each(['TILE', 'FILL'] as const)(
    'applyImageFill tracks temporary shaders for %s fills',
    (scaleMode) => {
      const { renderer, shaderDelete, shader } = createImageShaderFixture()
      const graph = createMockGraph()
      const node = createImageFillNode(scaleMode)
      const fill = node.fills[0] as ImageFill

      const applied = applyFill(renderer as never, fill, node, graph as SceneGraph)

      expect(applied).toBe(true)
      expect(renderer.imageFillShader).toBe(shader)
      expect(shaderDelete).not.toHaveBeenCalled()
      expect(renderer.fillPaint.setShader).toHaveBeenCalledWith(shader)
    }
  )

  test('renderShapeUncached deletes a temporary image shader even when drawing throws', () => {
    const { renderer, shaderDelete } = createImageShaderFixture()
    const graph = createMockGraph()
    const canvas = createMockCanvas()
    const node = createImageFillNode('TILE')

    renderer.applyFill = ((fill, nextNode, nextGraph, fillIndex) =>
      applyFill(renderer as never, fill, nextNode, nextGraph, fillIndex)) as never
    renderer.drawNodeFill = mock(() => {
      throw new Error('Simulated draw failure')
    })

    expect(() => {
      renderShapeUncached(renderer as never, canvas as never, node, graph as SceneGraph)
    }).toThrow('Simulated draw failure')

    expect(shaderDelete).toHaveBeenCalledTimes(1)
    expect(renderer.imageFillShader).toBeNull()
    expect(renderer.fillPaint.setShader).toHaveBeenCalledWith(null)
  })

  test('renderShapeUncached deletes image shader even when setShader(null) throws', () => {
    const { renderer, shaderDelete, shader } = createImageShaderFixture()
    const graph = createMockGraph()
    const canvas = createMockCanvas()
    const node = createImageFillNode('TILE')

    // Mock applyFill to set the shader without clearing it first,
    // so setShader(null) only fires inside drawVisibleFills' finally.
    renderer.applyFill = mock(() => {
      renderer.imageFillShader = shader
      return true
    })
    renderer.drawNodeFill = mock(() => undefined)
    // fillPaint.setShader(null) throws — but the inner finally must still delete the shader
    renderer.fillPaint.setShader = mock((val: unknown) => {
      if (val === null) throw new Error('setShader(null) crash')
    })

    expect(() => {
      renderShapeUncached(renderer as never, canvas as never, node, graph as SceneGraph)
    }).toThrow('setShader(null) crash')

    // THE critical invariant: shader.delete() MUST have been called
    // even though setShader(null) threw
    expect(shaderDelete).toHaveBeenCalledTimes(1)
  })
})
