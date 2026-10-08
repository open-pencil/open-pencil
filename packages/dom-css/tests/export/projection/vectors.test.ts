import { describe, expect, test } from 'bun:test'

import { sceneNodeToDesignDocument, sceneNodesToTailwindJSX } from '#dom-css/export/index'
import type { VectorElementRenderer } from '#dom-css/export/projection'
import type { DesignElement } from '#dom-css/types'

import { SceneGraph } from '@open-pencil/scene-graph'

/** A star with a fill, a stroke, and a shadow, inside a frame. */
function starInFrame() {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Card',
    width: 100,
    height: 100
  })
  const star = graph.createNode('STAR', frame.id, {
    name: 'Star',
    x: 10,
    y: 20,
    width: 40,
    height: 40,
    rotation: 15,
    opacity: 0.5,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  return { graph, frame, star }
}

/** Draws every vector layer as a one-path SVG, as the engine's SVG export would. */
const renderer: VectorElementRenderer = (_graph, node) => ({
  type: 'element',
  tagName: 'svg',
  attrs: { viewBox: `0 0 ${node.width} ${node.height}` },
  inlineStyle: { overflow: 'visible' },
  children: [
    {
      type: 'element',
      tagName: 'path',
      attrs: { d: 'M0 0L40 40', 'fill-rule': 'evenodd' },
      children: []
    }
  ]
})

function first(element: DesignElement): DesignElement {
  const child = element.children[0]
  if (child?.type !== 'element') throw new Error('No child element')
  return child
}

describe('vector layers', () => {
  test("project as the renderer's SVG, placed where the layer's box is", () => {
    const { graph, frame } = starInFrame()
    const card = sceneNodeToDesignDocument(graph, frame.id, { vectorElement: renderer }).children[0]
    if (card?.type !== 'element') throw new Error('No card')
    const star = first(card)
    expect(star.tagName).toBe('svg')
    expect(first(star).attrs.d).toBe('M0 0L40 40')
    expect(star.inlineStyle).toMatchObject({
      position: 'absolute',
      left: '10px',
      top: '20px',
      width: '40px',
      height: '40px',
      opacity: '0.5',
      transform: 'rotate(15deg)',
      overflow: 'visible'
    })
    // The SVG paints the star; the box would paint a rectangle.
    expect(
      Object.keys(star.inlineStyle ?? {}).filter((key) => key.startsWith('background'))
    ).toEqual([])
  })

  test('stay boxes without a renderer, as before', () => {
    const { graph, frame } = starInFrame()
    const card = sceneNodeToDesignDocument(graph, frame.id).children[0]
    if (card?.type !== 'element') throw new Error('No card')
    expect(first(card).tagName).toBe('div')
  })

  test("write SVG attributes in React's camel case in Tailwind JSX", () => {
    const { graph, frame } = starInFrame()
    const code = sceneNodesToTailwindJSX(graph, [frame.id], { vectorElement: renderer })
    expect(code).toContain('fillRule="evenodd"')
    expect(code).not.toContain('fill-rule')
  })
})
