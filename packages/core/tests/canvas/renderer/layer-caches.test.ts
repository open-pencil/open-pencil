import { afterEach, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

const ck = await initCanvasKit()
const SIZE = 100

const renderers: SkiaRenderer[] = []
afterEach(() => {
  for (const renderer of renderers.splice(0)) renderer.destroy()
})

/** A graph whose layer ids come from `ids` in order, as a file's saved ids would. */
function graphWithIds(ids: string[]) {
  let next = 0
  return new SceneGraph(() => ids[next++] ?? `9:${next}`)
}

const edge = (start: number, end: number) => ({
  start,
  end,
  tangentStart: { x: 0, y: 0 },
  tangentEnd: { x: 0, y: 0 }
})

/** A red vector filling the columns from `left` to `right` of the page's top 100 px. */
function addBar(graph: SceneGraph, left: number, right: number): string {
  const page = graph.getPages()[0]
  return graph.createNode('VECTOR', page.id, {
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    vectorNetwork: {
      vertices: [
        { x: left, y: 0 },
        { x: right, y: 0 },
        { x: right, y: SIZE },
        { x: left, y: SIZE }
      ],
      segments: [edge(0, 1), edge(1, 2), edge(2, 3), edge(3, 0)],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  }).id
}

function pixelsOf(image: ReturnType<typeof ck.MakeImageFromEncoded>) {
  const decoded = expectDefined(image, 'image')
  const pixels = expectDefined(
    decoded.readPixels(0, 0, {
      width: decoded.width(),
      height: decoded.height(),
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'pixels'
  )
  const width = decoded.width()
  decoded.delete()
  const red = (x: number) => {
    const at = (50 * width + x) * 4
    return pixels[at] > 200 && pixels[at + 1] < 50 && pixels[at + 2] < 50
  }
  return { left: red(20), right: red(80) }
}

function canvasEditor(graph: SceneGraph) {
  const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderers.push(renderer)
  const editor = createEditor({ graph })
  editor.setCanvasKit(ck, renderer)
  const draw = () => {
    Object.assign(editor.state, { panX: 0, panY: 0, zoom: 1 })
    renderer.renderFromEditorState(editor.state, editor.graph, null, SIZE, SIZE, false)
    return pixelsOf(renderer.surface.makeImageSnapshot())
  }
  return { editor, renderer, draw }
}

test('a replaced graph that reuses a layer id draws its own geometry', () => {
  const first = graphWithIds(['0:1', '0:2', '0:3'])
  const second = graphWithIds(['0:1', '0:2', '0:3'])
  const leftId = addBar(first, 0, 50)
  const rightId = addBar(second, 50, 100)
  expect(rightId).toBe(leftId)
  const { editor, renderer, draw } = canvasEditor(first)

  expect(draw()).toEqual({ left: true, right: false })
  editor.replaceGraph(second)

  expect(draw()).toEqual({ left: false, right: true })
  const png = renderNodesToImage(ck, renderer, editor.graph, editor.state.currentPageId, [rightId], {
    scale: 1,
    format: 'PNG'
  })
  expect(pixelsOf(ck.MakeImageFromEncoded(expectDefined(png, 'png')))).toEqual({
    left: false,
    right: true
  })
})

test('exporting another graph through the canvas renderer leaves the canvas its own geometry', () => {
  const document = graphWithIds(['0:1', '0:2', '0:3'])
  const library = graphWithIds(['0:1', '0:2', '0:3'])
  addBar(document, 0, 50)
  const libraryId = addBar(library, 50, 100)
  const { renderer, draw } = canvasEditor(document)
  expect(draw()).toEqual({ left: true, right: false })

  const png = renderNodesToImage(ck, renderer, library, library.getPages()[0].id, [libraryId], {
    scale: 1,
    format: 'PNG'
  })

  expect(pixelsOf(ck.MakeImageFromEncoded(expectDefined(png, 'png')))).toEqual({
    left: false,
    right: true
  })
  expect(draw()).toEqual({ left: true, right: false })
})

test('a layer created with a deleted layer’s id draws its own geometry', () => {
  const graph = graphWithIds(['0:1', '0:2', '0:3', '0:3'])
  const firstId = addBar(graph, 0, 50)
  const { draw } = canvasEditor(graph)
  expect(draw()).toEqual({ left: true, right: false })

  graph.deleteNode(firstId)
  expect(addBar(graph, 50, 100)).toBe(firstId)

  expect(draw()).toEqual({ left: false, right: true })
})
