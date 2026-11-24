import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

/**
 * An image or gradient shader that is not deleted after `setShader` pins the decoded image in the
 * WASM heap, about 3 MB per image fill and render. #868 and #963 fixed it; this keeps it fixed:
 * every such shader created while exporting must be deleted, and repeated exports must not grow
 * the heap. Idea from aldhubaib/content-intelligence-studio (INC-13, U-2).
 */
const ck = await initCanvasKit()
const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
const renderer = new SkiaRenderer(ck, surface)
afterAll(() => renderer.destroy())

interface Releasable {
  isDeleted(): boolean
}

function pngOf(size: number, seed: number): Uint8Array {
  const source = expectDefined(ck.MakeSurface(size, size), 'surface')
  source.getCanvas().clear(ck.Color(seed % 255, (seed * 37) % 255, (seed * 91) % 255, 1))
  const image = source.makeImageSnapshot()
  const bytes = expectDefined(image.encodeToBytes(), 'png')
  image.delete()
  source.delete()
  return bytes
}

function isDeleted(shader: object): boolean {
  const method: unknown = Reflect.get(shader, 'isDeleted')
  return typeof method === 'function' && Reflect.apply(method, shader, []) === true
}

/** The size of the WASM heap, which CanvasKit exposes at runtime without declaring it. */
function heapBytes(): number {
  const heap: unknown = Reflect.get(ck, 'HEAPU8')
  return heap instanceof Uint8Array ? heap.length : 0
}

/** Records every image, gradient, diamond, and pattern shader CanvasKit hands out until the returned function runs. */
function trackShaders(created: Releasable[]): () => void {
  const restores: (() => void)[] = []
  const wrap = (owner: object, name: string) => {
    const original: unknown = Reflect.get(owner, name)
    if (typeof original !== 'function') throw new Error(`CanvasKit has no ${name}`)
    Reflect.set(owner, name, function (this: unknown, ...args: unknown[]): unknown {
      const shader: unknown = Reflect.apply(original, this, args)
      if (typeof shader === 'object' && shader !== null) {
        created.push({ isDeleted: () => isDeleted(shader) })
      }
      return shader
    })
    restores.push(() => Reflect.set(owner, name, original))
  }
  const imageClass: unknown = Reflect.get(ck, 'Image')
  if (typeof imageClass !== 'function') throw new Error('CanvasKit has no Image')
  for (const name of ['makeShaderCubic', 'makeShaderOptions']) wrap(imageClass.prototype, name)
  // Diamond gradients are runtime-effect shaders; pattern fills are shaders over a recorded picture.
  const effectClass: unknown = Reflect.get(ck, 'RuntimeEffect')
  const pictureClass: unknown = Reflect.get(ck, 'Picture')
  if (typeof effectClass !== 'function' || typeof pictureClass !== 'function') {
    throw new TypeError('CanvasKit has no RuntimeEffect or Picture')
  }
  wrap(effectClass.prototype, 'makeShaderWithChildren')
  wrap(pictureClass.prototype, 'makeShader')
  for (const name of [
    'MakeLinearGradient',
    'MakeRadialGradient',
    'MakeTwoPointConicalGradient',
    'MakeSweepGradient'
  ]) {
    wrap(ck.Shader, name)
  }
  return () => {
    for (const restore of restores) restore()
  }
}

const GRADIENT: Fill = {
  type: 'GRADIENT_LINEAR',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.5,
  visible: true,
  gradientStops: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

const DIAMOND: Fill = { ...GRADIENT, type: 'GRADIENT_DIAMOND' }

describe('fill shaders are released', () => {
  test('exporting image, gradient, diamond, and pattern fills 30 times deletes every shader and keeps the heap flat', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const ids: string[] = []
    for (let i = 0; i < 6; i++) {
      const imageHash = `fill-shader-memory-${i}`
      graph.images.set(imageHash, pngOf(1024, i + 1))
      const image: Fill = {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash,
        imageScaleMode: i % 2 === 0 ? 'FILL' : 'TILE'
      }
      const node = graph.createNode('RECTANGLE', page, {
        x: (i % 3) * 70,
        y: Math.floor(i / 3) * 70,
        width: 64,
        height: 64,
        fills: [image, GRADIENT, DIAMOND]
      })
      ids.push(node.id)
    }

    const tile = graph.createNode('RECTANGLE', page, { x: 300, y: 0, width: 8, height: 8 })
    const pattern = graph.createNode('RECTANGLE', page, {
      x: 0,
      y: 140,
      width: 64,
      height: 64,
      fills: [
        {
          type: 'PATTERN',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          sourceNodeId: tile.id
        }
      ]
    })
    // The export copies only the exported layers, so the tile has to be one of them.
    ids.push(tile.id, pattern.id)

    const created: Releasable[] = []
    const stopTracking = trackShaders(created)
    const render = () => {
      renderer.invalidateAllPictures()
      expectDefined(
        renderNodesToImage(ck, renderer, graph, page, ids, { scale: 1, format: 'PNG' }),
        'export'
      )
    }
    try {
      for (let i = 0; i < 5; i++) render()
      const warm = heapBytes()
      expect(warm).toBeGreaterThan(0)
      for (let i = 0; i < 30; i++) render()
      expect(created.length).toBeGreaterThan(0)
      expect(created.filter((shader) => !shader.isDeleted())).toHaveLength(0)
      expect(heapBytes() - warm).toBeLessThan(48 * 1024 * 1024)
    } finally {
      stopTracking()
    }
  }, 120_000)
})
