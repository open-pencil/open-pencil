import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core'
import {
  exportFigFile,
  initCanvasKit,
  parseFigFile,
  renderNodesToImage
} from '@open-pencil/core/io'
import { readIcon, readIconTint, SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { iconColor, placeIcon, recolorIcon, swapIcon } from '#core/icons/render'
import { buildIconData } from '#core/icons/svg'

const BLACK = parseColor('#000000')

function insertIcon(graph: SceneGraph, body: string, viewBox = 24, size = 24) {
  const icon = buildIconData({ body }, 'test', 'icon', viewBox, viewBox, size)
  const page = graph.getPages()[0]
  const frame = placeIcon(graph, page.id, icon, { size, color: BLACK })
  return { page, frame, vectors: graph.getChildren(frame.id) }
}

describe('placeIcon', () => {
  test('keeps round stroke caps and joins after a .fig round trip', async () => {
    const graph = new SceneGraph()
    insertIcon(
      graph,
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9l6 6l6-6"/>'
    )

    const bytes = await exportFigFile(graph)
    const reopened = await parseFigFile(bytes.buffer as ArrayBuffer)
    const vector = expectDefined(
      [...reopened.nodes.values()].find((node) => node.type === 'VECTOR'),
      'reopened icon vector'
    )

    expect(vector.strokeCap).toBe('ROUND')
    expect(vector.strokeJoin).toBe('ROUND')
    expect(vector.strokes.map(({ cap, join }) => ({ cap, join }))).toEqual([
      { cap: 'ROUND', join: 'ROUND' }
    ])
  })

  test('fills open subpaths of a filled path together with its closed subpaths', async () => {
    const graph = new SceneGraph()
    // An open outer square around a closed, counter-wound inner square: a 24 px ring.
    const { page, frame } = insertIcon(
      graph,
      '<path fill="currentColor" d="M0 0h24v24H0M6 6v12h12V6z"/>'
    )

    const ck = await initCanvasKit()
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: false
        })
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png))
      const alphaAt = (x: number, y: number) => {
        const pixel = expectDefined(
          image.readPixels(x, y, {
            width: 1,
            height: 1,
            alphaType: ck.AlphaType.Unpremul,
            colorType: ck.ColorType.RGBA_8888,
            colorSpace: ck.ColorSpace.SRGB
          })
        )
        return pixel[3]
      }
      try {
        expect(alphaAt(3, 3)).toBe(255)
        expect(alphaAt(12, 12)).toBe(0)
      } finally {
        image.delete()
      }
    } finally {
      renderer.destroy()
    }
  })
})

describe('icon identity', () => {
  /** A two-path icon: one drawn in the icon's color, one in a fixed red. */
  const BODY =
    '<path fill="currentColor" d="M0 0h12v12H0z"/><path fill="#ff0000" d="M12 12h12v12H12z"/>'

  test('records the icon and which paints its color sets, and survives a .fig round trip', async () => {
    const graph = new SceneGraph()
    const { frame, vectors } = insertIcon(graph, BODY)
    expect(readIcon(frame)).toMatchObject({ name: 'test:icon' })
    expect(vectors.map(readIconTint)).toEqual([['fill'], []])

    const reopened = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const icon = [...reopened.nodes.values()].find((node) => readIcon(node))
    expect(icon && readIcon(icon)).toMatchObject({ name: 'test:icon' })
  })

  test("recolors only the paths drawn in the icon's color", () => {
    const graph = new SceneGraph()
    const { frame } = insertIcon(graph, BODY)
    const blue = parseColor('#0000ff')
    recolorIcon(graph, frame.id, blue)
    const [tinted, fixed] = graph.getChildren(frame.id)
    expect(tinted?.fills[0]?.color).toEqual(blue)
    expect(fixed?.fills[0]?.color).toEqual(parseColor('#ff0000'))
    expect(iconColor(graph, frame)).toEqual(blue)
  })

  test('swaps the glyph, keeping the frame, its size, and its color', () => {
    const graph = new SceneGraph()
    const { frame } = insertIcon(graph, BODY, 24, 32)
    const green = parseColor('#00ff00')
    recolorIcon(graph, frame.id, green)
    const other = buildIconData({ body: '<path fill="currentColor" d="M0 0h24v24H0z"/>' }, 'test', 'square', 24, 24, 32)
    swapIcon(graph, frame.id, other)

    const swapped = expectDefined(graph.getNode(frame.id), 'swapped icon')
    expect(readIcon(swapped)).toMatchObject({ name: 'test:square' })
    expect([swapped.width, swapped.height]).toEqual([32, 32])
    const paths = graph.getChildren(frame.id)
    expect(paths).toHaveLength(1)
    expect(paths[0]?.fills[0]?.color).toEqual(green)
  })

  test('leaves artwork without a name in a set unnamed', () => {
    const graph = new SceneGraph()
    const icon = buildIconData({ body: BODY }, 'svg', 'custom', 24, 24, 24)
    const frame = placeIcon(graph, graph.getPages()[0].id, icon, { size: 24, color: BLACK, identity: false })
    expect(readIcon(frame)).toBeNull()
  })
})
