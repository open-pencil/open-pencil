import { describe, expect, it } from 'bun:test'

import { designDocumentToLayers } from '#dom-css/import/scene-graph'
import type { DesignElement } from '#dom-css/types'

// The smallest PNG header a reader takes for a picture: signature, then a 1×1 IHDR.
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0
])
const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10"/></svg>'

function imported(element: DesignElement) {
  const { graph, svgs } = designDocumentToLayers({ type: 'document', children: [element] })
  const [layer] = graph.getChildren(graph.getPages()[0].id)
  return { graph, svgs, layer }
}

describe('pictures in imported elements', () => {
  it('fills an image with the picture its runtime loaded, from srcset as from src', () => {
    const { layer } = imported({
      type: 'element',
      tagName: 'img',
      attrs: { srcset: 'logo.png 1x' },
      computedStyle: { display: 'block', width: '20px', height: '20px' },
      image: { url: 'https://site.example.test/logo.png', bytes: PNG, contentType: 'image/png' },
      children: []
    })

    expect(layer.fills.map((fill) => fill.type)).toEqual(['IMAGE'])
  })

  it("draws a video's SVG poster as artwork, over the sources it holds", () => {
    const video: DesignElement = {
      type: 'element',
      tagName: 'video',
      attrs: { poster: 'logo.svg' },
      computedStyle: { display: 'block', width: '40px', height: '20px' },
      image: {
        url: 'https://site.example.test/logo.svg',
        bytes: new TextEncoder().encode(LOGO),
        contentType: 'image/svg+xml'
      },
      children: [{ type: 'element', tagName: 'source', attrs: { src: 'logo.mp4' }, children: [] }]
    }
    const { graph, svgs, layer } = imported(video)

    expect(svgs.get(layer.id)).toBe(video)
    expect(graph.getChildren(layer.id)).toEqual([])
  })
})
