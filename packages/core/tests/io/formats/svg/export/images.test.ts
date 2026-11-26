import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { pngHeader } from './helpers'

const HASH = 'svg-export-image'

function exported(fill: Partial<Fill>): { pattern: string; image: string } {
  const graph = new SceneGraph()
  graph.images.set(HASH, pngHeader(40, 20))
  const page = graph.getPages()[0].id
  const rectangle = graph.createNode('RECTANGLE', page, {
    width: 100,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: HASH,
        ...fill
      }
    ]
  })
  const svg = renderNodesToSVG(graph, page, [rectangle.id], { xmlDeclaration: false }) ?? ''
  return {
    pattern: svg.match(/<pattern\b[^>]*>/)?.[0] ?? '',
    image: (svg.match(/<image\b[^>]*>/)?.[0] ?? '').replace(/ href="[^"]*"/, '')
  }
}

// Each places the image as the canvas does (`imageFillMatrix`), where `slice` covered them all.
describe('an image fill exported to SVG', () => {
  test('a crop shows the part of the image its transform holds', () => {
    // The middle half of the image, both ways, stretched over the layer.
    const { pattern, image } = exported({
      imageScaleMode: 'CROP',
      imageTransform: { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }
    })
    expect(pattern).toContain('width="100" height="100"')
    expect(image).toContain('transform="matrix(5 0 0 10 -50 -50)"')
  })

  test('a tile repeats the image at its scale', () => {
    const { pattern, image } = exported({ imageScaleMode: 'TILE', scale: 0.5 })
    expect(pattern).toContain('width="20" height="10"')
    expect(image).toContain('transform="matrix(0.5 0 0 0.5 0 0)"')
  })

  test('a small tile keeps its exact period', () => {
    // 40 × 20 at 1/320 is 0.125 × 0.0625: rounded to hundredths, tiles would leave gaps.
    const { pattern } = exported({ imageScaleMode: 'TILE', scale: 0.003125 })
    expect(pattern).toContain('width="0.125" height="0.0625"')
  })

  test('a turned fill covers the layer with the image turned', () => {
    // Turned a quarter, the image is 20 × 40; covering 100 × 100 scales it by 5 and centres it.
    const { image } = exported({ imageScaleMode: 'FILL', imageRotation: 90 })
    expect(image).toContain('transform="matrix(0 5 -5 0 100 -50)"')
  })
})
