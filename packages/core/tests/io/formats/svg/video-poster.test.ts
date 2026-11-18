import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

const POSTER = 'video-poster-frame'
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const video: Fill = {
  type: 'VIDEO',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  imageHash: POSTER,
  videoHash: 'a'.repeat(40),
  imageScaleMode: 'FILL'
}

function exportedRectangle(fill: Fill, images: Map<string, Uint8Array>): string {
  const graph = new SceneGraph()
  for (const [hash, bytes] of images) {
    graph.images.set(hash, bytes)
  }
  const page = graph.getPages()[0].id
  const rectangle = graph.createNode('RECTANGLE', page, { width: 10, height: 10, fills: [fill] })
  return renderNodesToSVG(graph, page, [rectangle.id], { xmlDeclaration: false }) ?? ''
}

describe('a video fill exported to SVG', () => {
  test('draws its poster frame as an image does', () => {
    const images = new Map([[POSTER, PNG_SIGNATURE]])
    const fromVideo = exportedRectangle(video, images)
    const fromImage = exportedRectangle({ ...video, type: 'IMAGE', videoHash: undefined }, images)

    expect(fromVideo).toContain('<image href="data:image/png;base64,')
    expect(fromVideo).toBe(fromImage)
  })

  test('draws nothing while its poster frame is missing', () => {
    expect(exportedRectangle(video, new Map())).not.toContain('<image')
  })
})
