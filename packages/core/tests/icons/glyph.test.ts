import { describe, expect, test } from 'bun:test'

import { isIconModified, readIcon, readIconTint, SceneGraph, withIcon } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import {
  collectResizeDescendants,
  computeConstrainedResizeChanges
} from '@open-pencil/scene-graph/resize'

import { detachIcon, placeIcon, recolorIcon, swapIcon } from '#core/icons/render'
import { buildIconData } from '#core/icons/svg'

const BLACK = parseColor('#000000')
const OUTLINE = '<path fill="none" stroke="currentColor" stroke-width="2" d="M4 4h16v16H4z"/>'
const LOGO = '<path fill="#e11d48" d="M2 2h20v20H2z"/><path fill="currentColor" d="M8 8h8v8H8z"/>'

function placed(body: string) {
  const graph = new SceneGraph()
  const icon = buildIconData({ body }, 'test', 'icon', 24, 24, 24)
  const frame = placeIcon(graph, graph.getPages()[0].id, icon, { size: 24, color: BLACK })
  const modified = () => isIconModified(graph, graph.getNode(frame.id) ?? frame)
  return { graph, frame, modified }
}

/** Resizes the icon as the canvas handles do, its paths following their constraints. */
function resize(graph: SceneGraph, id: string, width: number, height: number) {
  const node = graph.getNode(id)
  if (!node) throw new Error('Expected the icon')
  // Nodes change in place, so the size before is copied out.
  const before = { width: node.width, height: node.height }
  const originals = collectResizeDescendants(graph, id)
  graph.updateNode(id, { width, height })
  if (!originals) return
  const changes = computeConstrainedResizeChanges(graph, id, before, { width, height }, originals)
  for (const [childId, change] of changes) graph.updateNode(childId, change)
}

describe('icon glyphs', () => {
  test('a placed icon is as placed, and stays so when recolored or resized, unevenly too', () => {
    const { graph, frame, modified } = placed(OUTLINE)
    expect(readIcon(graph.getNode(frame.id) ?? frame)?.glyph).toMatch(/^[0-9a-f]{8}$/)
    expect(modified()).toBe(false)

    recolorIcon(graph, frame.id, parseColor('#4f46e5'))
    resize(graph, frame.id, 37, 37)
    expect(modified()).toBe(false)
    resize(graph, frame.id, 40, 20)
    expect(modified()).toBe(false)
  })

  test('resizing scales the glyph with its frame', () => {
    const { graph, frame } = placed(OUTLINE)
    resize(graph, frame.id, 48, 48)
    expect(graph.getChildren(frame.id)[0]).toMatchObject({ width: 48, height: 48 })
  })

  test('moving a point, adding a path, or changing a color of its own is an edit', () => {
    const point = placed(OUTLINE)
    const path = point.graph.getChildren(point.frame.id)[0]
    const network = path?.vectorNetwork
    if (!path || !network) throw new Error('Expected a path')
    point.graph.updateNode(path.id, {
      vectorNetwork: {
        ...network,
        vertices: network.vertices.map((vertex, index) =>
          index === 0 ? { ...vertex, x: vertex.x + 3 } : vertex
        )
      }
    })
    expect(point.modified()).toBe(true)

    const added = placed(OUTLINE)
    added.graph.createNode('RECTANGLE', added.frame.id, { width: 4, height: 4 })
    expect(added.modified()).toBe(true)

    const logo = placed(LOGO)
    const own = logo.graph.getChildren(logo.frame.id).find((child) => readIconTint(child).length === 0)
    if (!own) throw new Error('Expected a path with its own color')
    logo.graph.updateNode(own.id, {
      fills: own.fills.map((fill) => ({ ...fill, color: parseColor('#16a34a') }))
    })
    expect(logo.modified()).toBe(true)
  })

  test('a swap draws a fresh glyph, so an edited icon is as placed again', () => {
    const { graph, frame, modified } = placed(OUTLINE)
    graph.createNode('RECTANGLE', frame.id, { width: 4, height: 4 })
    swapIcon(graph, frame.id, buildIconData({ body: OUTLINE }, 'test', 'other', 24, 24, 24))
    expect(modified()).toBe(false)
  })

  test('rotating or fading a path is an edit', () => {
    for (const change of [{ rotation: 15 }, { opacity: 0.5 }]) {
      const { graph, frame, modified } = placed(OUTLINE)
      const path = graph.getChildren(frame.id)[0]
      if (!path) throw new Error('Expected a path')
      graph.updateNode(path.id, change)
      expect(modified()).toBe(true)
    }
  })

  test('a swap into an unevenly resized icon stretches the glyph to it', () => {
    const { graph, frame, modified } = placed(OUTLINE)
    resize(graph, frame.id, 40, 20)
    swapIcon(graph, frame.id, buildIconData({ body: OUTLINE }, 'test', 'other', 24, 24, 20))

    expect(graph.getChildren(frame.id)[0]).toMatchObject({ width: 40, height: 20 })
    expect(modified()).toBe(false)
  })

  test('an icon placed before glyphs were recorded counts as unedited', () => {
    const { graph, frame, modified } = placed(OUTLINE)
    const node = graph.getNode(frame.id) ?? frame
    const icon = readIcon(node)
    if (!icon) throw new Error('Expected an icon')
    graph.updateNode(frame.id, { pluginData: withIcon(node, { name: icon.name }) })
    graph.createNode('RECTANGLE', frame.id, { width: 4, height: 4 })
    expect(modified()).toBe(false)
  })

  test('detaching leaves the paths as drawn, with no icon or tint left', () => {
    const { graph, frame } = placed(OUTLINE)
    const before = graph.getChildren(frame.id).map((path) => path.vectorNetwork)
    detachIcon(graph, frame.id)

    expect(readIcon(graph.getNode(frame.id) ?? frame)).toBeNull()
    const paths = graph.getChildren(frame.id)
    expect(paths.map((path) => readIconTint(path))).toEqual([[]])
    expect(paths.map((path) => path.vectorNetwork)).toEqual(before)
  })
})
