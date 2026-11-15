import { afterAll, describe, expect, test } from 'bun:test'

import { effect, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

describe('drop shadows bounded where their ink fades', () => {
  const CANVAS = 800

  function glowingFrames(graph: SceneGraph, page: string): string[] {
    const ids: string[] = []
    for (const [index, rotation] of [0, 30].entries()) {
      for (const [row, opacity] of [1, 0.6].entries()) {
        const parent = graph.createNode('FRAME', page, {
          x: 40 + index * 200,
          y: 40 + row * 200,
          width: 40,
          height: 40,
          rotation,
          opacity,
          fills: [solid(1, 0.8, 0.6)],
          clipsContent: false,
          effects: [{ ...effect('DROP_SHADOW', 20), spread: 4 }, effect('LAYER_BLUR', 2)]
        })
        graph.createNode('RECTANGLE', parent.id, {
          x: 50,
          width: 40,
          height: 20,
          fills: [solid(0, 0, 1)],
          effects: [effect('DROP_SHADOW', 12)]
        })
        ids.push(parent.id)
      }
    }
    return ids
  }

  function shadowedSquare(radius: number, alpha: number) {
    return (graph: SceneGraph, page: string): string[] => {
      const square = graph.createNode('RECTANGLE', page, {
        x: 300,
        y: 300,
        width: 200,
        height: 200,
        opacity: 0.99,
        fills: [solid(0, 0, 0)],
        effects: [{ ...effect('DROP_SHADOW', radius), color: { r: 1, g: 1, b: 1, a: alpha } }]
      })
      return [square.id]
    }
  }

  /** A closed rectangle as a saved path, the form a vector's fill geometry takes. */
  function rectanglePathBlob(x: number, y: number, width: number, height: number): Uint8Array {
    const corners = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ]
    const blob = new Uint8Array(corners.length * 9 + 1)
    const view = new DataView(blob.buffer)
    for (const [index, [cornerX, cornerY]] of corners.entries()) {
      blob[index * 9] = index === 0 ? 1 : 2
      view.setFloat32(index * 9 + 1, cornerX, true)
      view.setFloat32(index * 9 + 5, cornerY, true)
    }
    return blob
  }

  function shadowedPathPastItsBox(graph: SceneGraph, page: string): string[] {
    const vector = graph.createNode('VECTOR', page, {
      x: 200,
      y: 300,
      width: 40,
      height: 40,
      opacity: 0.6,
      fills: [solid(0, 0, 1)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectanglePathBlob(0, 0, 300, 40) }],
      effects: [{ ...effect('DROP_SHADOW', 30), color: { r: 1, g: 0, b: 0, a: 1 } }]
    })
    return [vector.id]
  }

  /** A closed rectangle as a vector network, the form a vector's strokes are drawn from. */
  function rectangleNetwork(width: number, height: number): VectorNetwork {
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]
    const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    return {
      vertices: corners,
      segments: corners.map((_, index) => ({ start: index, end: (index + 1) % 4, ...straight })),
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  }

  function strokedPathPastItsBox(graph: SceneGraph, page: string): string[] {
    const vector = graph.createNode('VECTOR', page, {
      x: 200,
      y: 300,
      width: 40,
      height: 40,
      opacity: 0.6,
      fills: [solid(0, 0, 1)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectanglePathBlob(0, 0, 300, 40) }],
      vectorNetwork: rectangleNetwork(300, 40),
      strokes: [{ ...solid(1, 0, 0), weight: 20, align: 'OUTSIDE' }],
      strokeWeight: 20,
      strokeAlign: 'OUTSIDE'
    })
    return [vector.id]
  }

  /** Every pixel of a scene, its layers bounded or opened over the whole canvas. */
  function scenePixels(
    build: (graph: SceneGraph, page: string) => string[],
    boundLayers: boolean
  ): Float32Array | Uint8Array {
    const graph = new SceneGraph()
    const ids = build(graph, graph.getPages()[0].id)
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      if (!boundLayers) {
        const saveLayer = canvas.saveLayer.bind(canvas)
        canvas.saveLayer = (paint, _bounds, ...rest) => saveLayer(paint, null, ...rest)
      }
      canvas.clear(ck.TRANSPARENT)
      for (const id of ids) {
        renderer.renderNode(canvas, graph, id, {})
      }
      surface.flush()
      return expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Premul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test.each([
    ['glowing frames under a layer blur', glowingFrames],
    ['an opaque white 60px shadow at 0.99 opacity', shadowedSquare(60, 1)],
    ["Figma's default 25% shadow at 60px and 0.99 opacity", shadowedSquare(60, 0.25)],
    ['a 10% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.1)],
    ['a 49% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.49)],
    ['a 50% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.5)],
    ['a vector path past its box with a drop shadow, at 0.6 opacity', shadowedPathPastItsBox],
    ['a vector path past its box with an outside stroke, at 0.6 opacity', strokedPathPastItsBox]
  ])('draws %s as layers with no bounds do, on CPU raster', (_, build) => {
    const bounded = scenePixels(build, true)
    const unbounded = scenePixels(build, false)
    let differing = 0
    for (let index = 0; index < bounded.length; index++) {
      if (bounded[index] !== unbounded[index]) {
        differing++
      }
    }
    expect(unbounded.some((value) => value > 0)).toBe(true)
    expect(differing).toBe(0)
  })
})

describe('a node picture drawn into a tile that shows only its shadow', () => {
  const CANVAS = 300
  const boxRight = 100 + 100
  const tileLeft = boxRight + 22

  /** Alpha summed over the strip from `tileLeft` rightward, the tile clipped there or not. */
  function shadowInk(clipToTile: boolean): number {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const square = graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [solid(0, 0, 0)],
      effects: [{ ...effect('DROP_SHADOW', 20), color: { r: 0, g: 0, b: 0, a: 1 } }]
    })
    renderer.nodePictures.delete(square.id)
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      canvas.save()
      if (clipToTile) {
        canvas.clipRect(ck.LTRBRect(tileLeft, 0, CANVAS, CANVAS), ck.ClipOp.Intersect, false)
      }
      renderer.renderNode(canvas, graph, square.id, {})
      canvas.restore()
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let ink = 0
      for (let y = 0; y < CANVAS; y++) {
        for (let x = tileLeft; x < CANVAS; x++) {
          ink += pixels[(y * CANVAS + x) * 4 + 3]
        }
      }
      renderer.nodePictures.delete(square.id)
      return ink
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test('draws the same shadow there as a canvas that shows all of it', () => {
    const whole = shadowInk(false)
    expect(whole).toBeGreaterThan(0)
    expect(shadowInk(true)).toBe(whole)
  })
})
