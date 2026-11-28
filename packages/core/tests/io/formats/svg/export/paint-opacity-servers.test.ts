import { describe, expect, test } from 'bun:test'

import type { Fill, SceneGraph, Stroke } from '@open-pencil/scene-graph'

import { moveTo, paths, rects, solid, svgOf } from './helpers'

const IMAGE_HASH = 'svg-paint-opacity-image'

function gradient(type: Fill['type'], opacity: number, stopAlpha = 1): Fill {
  return {
    type,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity,
    visible: true,
    gradientStops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: stopAlpha } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
}

function image(opacity: number, imageScaleMode: Fill['imageScaleMode'] = 'FILL'): Fill {
  return {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity,
    visible: true,
    imageHash: IMAGE_HASH,
    imageScaleMode
  }
}

function rectangleWith(fills: Fill[], strokes: Stroke[] = []) {
  return (graph: SceneGraph, pageId: string) => {
    graph.images.set(IMAGE_HASH, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    return [graph.createNode('RECTANGLE', pageId, { width: 40, height: 40, fills, strokes }).id]
  }
}

describe('gradient and image paint opacity exported to SVG', () => {
  for (const type of [
    'GRADIENT_LINEAR',
    'GRADIENT_RADIAL',
    'GRADIENT_ANGULAR',
    'GRADIENT_DIAMOND'
  ] as const) {
    test(`fades a ${type} fill by its opacity in every color space`, () => {
      const build = rectangleWith([gradient(type, 0.5)])
      for (const colorSpace of ['srgb', 'display-p3'] as const) {
        expect(rects(svgOf(build, { colorSpace }))).toEqual([
          '<rect width="40" height="40" fill="url(#grad0)" fill-opacity="0.5"/>'
        ])
      }
    })
  }

  test('keeps stop alpha on the stop, so the viewer multiplies it by the paint opacity', () => {
    const svg = svgOf(rectangleWith([gradient('GRADIENT_LINEAR', 0.5, 0.4)]))
    expect(svg).toContain('<stop offset="0%" stop-color="#FF0000" stop-opacity="0.4"/>')
    expect(rects(svg)).toEqual([
      '<rect width="40" height="40" fill="url(#grad0)" fill-opacity="0.5"/>'
    ])
  })

  test('leaves an opaque gradient without fill-opacity', () => {
    expect(rects(svgOf(rectangleWith([gradient('GRADIENT_LINEAR', 1)])))).toEqual([
      '<rect width="40" height="40" fill="url(#grad0)"/>'
    ])
  })

  for (const mode of ['FILL', 'TILE'] as const) {
    test(`fades a ${mode} image fill by its opacity`, () => {
      expect(rects(svgOf(rectangleWith([image(0.5, mode)])))).toEqual([
        '<rect width="40" height="40" fill="url(#img0)" fill-opacity="0.5"/>'
      ])
    })
  }

  test('fades only the translucent one of two stacked fills', () => {
    const svg = svgOf(rectangleWith([solid(0, 0, 0, 1, 1), gradient('GRADIENT_LINEAR', 0.5)]))
    expect(rects(svg)).toEqual([
      '<rect width="40" height="40" fill="#000000"/>',
      '<rect width="40" height="40" fill="url(#grad0)" fill-opacity="0.5"/>'
    ])
  })

  test('writes a gradient stroke opacity as stroke-opacity and leaves the fill alone', () => {
    const stroke: Stroke = { ...gradient('GRADIENT_LINEAR', 0.5), weight: 2, align: 'CENTER' }
    expect(rects(svgOf(rectangleWith([solid(0, 0, 0, 1, 1)], [stroke])))).toEqual([
      '<rect width="40" height="40" fill="#000000" stroke="#000000" stroke-width="2" stroke-opacity="0.5"/>'
    ])
  })

  test('fades a text gradient fill by its opacity', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, {
        text: 'Ab',
        width: 40,
        height: 20,
        fills: [gradient('GRADIENT_LINEAR', 0.5)]
      }).id
    ])
    expect(svg).toContain('fill="url(#grad0)" fill-opacity="0.5"')
  })

  test('keeps a translucent Display P3 run at its own alpha under a translucent text fill', () => {
    const svg = svgOf(
      (graph, pageId) => [
        graph.createNode('TEXT', pageId, {
          text: 'Ab',
          width: 40,
          height: 20,
          fills: [gradient('GRADIENT_LINEAR', 0.5)],
          styleRuns: [
            { start: 0, length: 1, style: {} },
            { start: 1, length: 1, style: { fills: [solid(0, 0, 0, 1, 0.5)] } }
          ]
        }).id
      ],
      { colorSpace: 'display-p3' }
    )
    expect(svg).toContain('<tspan fill="color(display-p3 0 0 0 / 0.5)" fill-opacity="1">b</tspan>')
  })

  test("fades each painted region's gradient by its opacity", () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 40,
        height: 40,
        vectorNetwork: {
          vertices: [],
          segments: [],
          regions: [
            { windingRule: 'NONZERO', loops: [], fills: [gradient('GRADIENT_LINEAR', 0.5)] }
          ]
        },
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) }]
      }).id
    ])
    expect(paths(svg)).toEqual(['<path d="M0 0" fill="url(#grad0)" fill-opacity="0.5"/>'])
  })

  test('writes no fill-opacity for a paint SVG cannot draw', () => {
    const unbuilt: Fill = { ...gradient('GRADIENT_LINEAR', 0.5), gradientStops: undefined }
    const stroke: Stroke = { ...solid(0, 0, 0, 1, 1), weight: 2, align: 'CENTER' }
    expect(rects(svgOf(rectangleWith([unbuilt], [stroke])))).toEqual([
      '<rect width="40" height="40" fill="none" stroke="#000000" stroke-width="2"/>'
    ])
  })
})
