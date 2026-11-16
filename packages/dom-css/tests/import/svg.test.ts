import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers } from '#dom-css/import/scene-graph'
import type { DesignElement, DesignStyleDeclaration } from '#dom-css/types'

function svg(
  attrs: Record<string, string>,
  computedStyle: DesignStyleDeclaration = {}
): DesignElement {
  return {
    type: 'element',
    tagName: 'svg',
    attrs,
    computedStyle: { display: 'inline', ...computedStyle },
    children: [{ type: 'element', tagName: 'path', attrs: { d: 'M0 0h1v1z' }, children: [] }]
  }
}

function imported(element: DesignElement) {
  const { graph, svgs } = designDocumentToLayers({ type: 'document', children: [element] })
  const [frame] = graph.getChildren(graph.getPages()[0].id)
  return { graph, svgs, frame }
}

describe('inline SVG import', () => {
  it('builds a frame without layers for its shapes, recorded for the caller to draw', () => {
    const element = svg(
      { width: '24', height: '24', viewBox: '0 0 24 24' },
      { width: '24px', height: '24px' }
    )
    const { graph, svgs, frame } = imported(element)

    expect(frame).toMatchObject({ type: 'FRAME', layoutMode: 'NONE', width: 24, height: 24 })
    expect(graph.getChildren(frame.id)).toEqual([])
    expect(svgs.get(frame.id)).toBe(element)
  })

  it('sizes a side its style leaves auto by the viewBox, as a browser sizes the SVG', () => {
    expect(
      imported(svg({ viewBox: '0 0 400 100' }, { height: '22px', width: 'auto' })).frame
    ).toMatchObject({
      width: 88,
      height: 22
    })
    expect(
      imported(svg({ viewBox: '0 0 40 20' }, { width: '30px', height: 'auto' })).frame
    ).toMatchObject({
      width: 30,
      height: 15
    })
    // Without a viewBox, its attributes size it, else the default of a replaced element.
    expect(imported(svg({ width: '16' })).frame).toMatchObject({ width: 16, height: 150 })
  })
})
