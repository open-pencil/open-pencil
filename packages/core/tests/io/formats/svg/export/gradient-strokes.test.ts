import { describe, expect, test } from 'bun:test'

import type { Fill, SceneGraph, Stroke } from '@open-pencil/scene-graph'

import { BLACK_STROKE, moveTo, paths, pngHeader, rects, svgOf } from './helpers'

const IMAGE_HASH = 'svg-stroke-paint-image'

const RED_TO_BLUE: Stroke = {
  ...BLACK_STROKE,
  type: 'GRADIENT_LINEAR',
  weight: 4,
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

const IMAGE_STROKE: Stroke = {
  ...BLACK_STROKE,
  type: 'IMAGE',
  weight: 4,
  imageHash: IMAGE_HASH,
  imageScaleMode: 'FILL'
}

function strokedRect(strokes: Stroke[], fills: Fill[] = []) {
  return (graph: SceneGraph, pageId: string) => [
    graph.createNode('RECTANGLE', pageId, { width: 40, height: 20, fills, strokes }).id
  ]
}

function elements(svg: string, tag: string): string[] {
  return Array.from(svg.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g')), ([element]) => element)
}

function withoutDefs(svg: string): string {
  return svg.replace(/<defs>[\s\S]*<\/defs>/, '')
}

function onlyGradient(svg: string): string {
  const gradients = elements(svg, 'linearGradient')
  expect(gradients).toHaveLength(1)
  return gradients[0]
}

describe('a gradient stroke exports as the gradient the canvas strokes with', () => {
  test('on a rectangle, laid on the layer box in user space', () => {
    const svg = svgOf(strokedRect([RED_TO_BLUE]))
    expect(rects(svg)).toEqual([
      '<rect width="40" height="20" fill="none" stroke="url(#grad0)" stroke-width="4"/>'
    ])
    expect(onlyGradient(svg)).toBe(
      '<linearGradient id="grad0" x1="0" y1="0.5" x2="1" y2="0.5" gradientUnits="userSpaceOnUse" gradientTransform="matrix(40 0 0 20 0 0)">'
    )
    expect(elements(svg, 'stop')).toEqual([
      '<stop offset="0%" stop-color="#FF0000"/>',
      '<stop offset="100%" stop-color="#0000FF"/>'
    ])
  })

  test('maps a turned gradient onto the layer box as the canvas does', () => {
    const turned = {
      ...RED_TO_BLUE,
      gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    }
    const svg = svgOf(strokedRect([turned]))
    expect(onlyGradient(svg)).toContain('gradientTransform="matrix(0 20 -40 0 40 0)"')
  })

  test.each(['INSIDE', 'OUTSIDE'] as const)('inside or outside the outline: %s', (align) => {
    const svg = svgOf(strokedRect([{ ...RED_TO_BLUE, align }]))
    const [stroked] = paths(withoutDefs(svg))
    expect(stroked).toContain('fill="none" stroke="url(#grad')
    expect(stroked).toContain('stroke-width="8"')
    expect(onlyGradient(svg)).toContain('gradientUnits="userSpaceOnUse"')
  })

  test('at its own opacity, with its dashes', () => {
    const svg = svgOf(strokedRect([{ ...RED_TO_BLUE, opacity: 0.5, dashPattern: [6, 3] }]))
    const [rect] = rects(svg)
    expect(rect).toContain('stroke="url(#grad0)"')
    expect(rect).toContain('stroke-opacity="0.5"')
    expect(rect).toContain('stroke-dasharray="6 3"')
  })

  test('over a gradient fill, which keeps its bounding-box units', () => {
    const fill: Fill = { ...RED_TO_BLUE, type: 'GRADIENT_RADIAL' }
    const svg = svgOf(strokedRect([RED_TO_BLUE], [fill]))
    expect(elements(svg, 'radialGradient')[0]).toBe(
      '<radialGradient id="grad0" cx="0.5" cy="0.5" r="0.5" gradientUnits="objectBoundingBox">'
    )
    expect(onlyGradient(svg)).toContain('id="grad1"')
    expect(rects(svg)).toEqual([
      '<rect width="40" height="20" fill="url(#grad0)" stroke="url(#grad1)" stroke-width="4"/>'
    ])
  })

  test('on an ellipse', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('ELLIPSE', pageId, { width: 30, height: 30, strokes: [RED_TO_BLUE] }).id
    ])
    expect(elements(svg, 'ellipse')[0]).toContain('stroke="url(#grad0)"')
    expect(onlyGradient(svg)).toContain('gradientTransform="matrix(30 0 0 30 0 0)"')
  })

  test('on a straight line, whose zero height still spans the gradient across one pixel', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('LINE', pageId, {
        width: 100,
        height: 0,
        strokeCap: 'TRIANGLE_FILLED',
        strokes: [RED_TO_BLUE]
      }).id
    ])
    expect(elements(svg, 'line')[0]).toContain('stroke="url(#grad0)"')
    expect(onlyGradient(svg)).toContain(
      'gradientUnits="userSpaceOnUse" gradientTransform="matrix(100 0 0 1 0 0)"'
    )
    const heads = paths(svg)
    expect(heads).toHaveLength(2)
    for (const head of heads) {
      expect(head).toContain('fill="url(#grad0)"')
    }
  })

  test('as a line arrow head, stroked with the gradient', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('LINE', pageId, {
        width: 100,
        height: 0,
        strokeCap: 'ARROW_LINES',
        strokes: [{ ...RED_TO_BLUE, opacity: 0.5 }]
      }).id
    ])
    for (const head of paths(svg)) {
      expect(head).toContain('fill="none" stroke="url(#grad0)" stroke-opacity="0.5"')
    }
  })

  test('as a vector stroke saved as geometry, filled with the gradient', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        strokes: [{ ...RED_TO_BLUE, opacity: 0.5 }],
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) }],
        strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(1, 1) }]
      }).id
    ])
    expect(paths(svg)).toEqual([
      '<path d="M0 0" fill="none" stroke="none" stroke-width="4" stroke-opacity="0.5"/>',
      '<path d="M1 1" fill="url(#grad0)" fill-opacity="0.5" stroke="none"/>'
    ])
  })

  test('as saved stroke geometry, keeps each outline winding rule as the canvas fills it', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        strokes: [RED_TO_BLUE],
        strokeGeometry: [
          { windingRule: 'EVENODD', commandsBlob: moveTo(1, 1) },
          { windingRule: 'NONZERO', commandsBlob: moveTo(2, 2) }
        ]
      }).id
    ])
    expect(paths(svg).slice(-2)).toEqual([
      '<path d="M1 1" fill="url(#grad0)" fill-rule="evenodd" stroke="none"/>',
      '<path d="M2 2" fill="url(#grad0)" stroke="none"/>'
    ])
  })

  test('on text, its saved stroke geometry filled with the gradient over the glyphs', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, {
        text: 'A',
        width: 20,
        height: 20,
        strokes: [{ ...RED_TO_BLUE, opacity: 0.5 }],
        strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(2, 3) }]
      }).id
    ])
    expect(svg.indexOf('<text')).toBeLessThan(svg.indexOf('<path'))
    expect(paths(svg)).toEqual([
      '<path d="M2 3" fill="url(#grad0)" fill-opacity="0.5" stroke="none"/>'
    ])
    expect(onlyGradient(svg)).toContain('gradientTransform="matrix(20 0 0 20 0 0)"')
  })

  test('on text along a path, under the glyphs, as the canvas strokes it first', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, {
        text: 'A',
        width: 20,
        height: 20,
        strokes: [RED_TO_BLUE],
        strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(2, 3) }],
        derivedTextGlyphs: [{ commandsBlob: moveTo(0, 0), x: 0, y: 0, fontSize: 14 }],
        textPathData: {
          network: { vertices: [], segments: [], regions: [] },
          normalizedSize: { x: 20, y: 20 },
          tValue: 0,
          forward: true
        }
      }).id
    ])
    const stroke = svg.indexOf('<path d="M2 3" fill="url(#grad0)"')
    expect(stroke).toBeGreaterThan(-1)
    expect(stroke).toBeLessThan(svg.indexOf('<text'))
  })

  test('on text without saved stroke geometry, leaves no unused gradient behind', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, { text: 'A', width: 20, height: 20, strokes: [RED_TO_BLUE] })
        .id
    ])
    expect(svg).not.toContain('<defs>')
    expect(paths(svg)).toEqual([])
  })

  test('on text with an inside stroke, kept to the text box as the canvas clips it', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, {
        text: 'A',
        width: 20,
        height: 20,
        strokes: [{ ...RED_TO_BLUE, align: 'INSIDE' }],
        strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(2, 3) }]
      }).id
    ])
    expect(paths(withoutDefs(svg))).toEqual([
      '<path d="M2 3" fill="url(#grad0)" stroke="none" clip-path="url(#clip1)"/>'
    ])
    expect(svg).toMatch(/<clipPath id="clip1">\s*<path d="M0 0L20 0L20 20L0 20L0 0Z"\/>/)
  })
})

describe('an image stroke', () => {
  function imageStroked(stroke: Stroke, build = strokedRect([stroke])) {
    return svgOf((graph, pageId) => {
      graph.images.set(IMAGE_HASH, pngHeader(4, 4))
      return build(graph, pageId)
    })
  }

  test('exports as the image pattern fills use, reaching as far as the stroke paints', () => {
    const svg = imageStroked({ ...IMAGE_STROKE, opacity: 0.5 })
    expect(rects(svg)).toEqual([
      '<rect width="40" height="20" fill="none" stroke="url(#img0)" stroke-width="4" stroke-opacity="0.5"/>'
    ])
    expect(elements(svg, 'pattern')).toEqual([
      '<pattern id="img0" patternUnits="userSpaceOnUse" x="-16" y="-16" width="72" height="52">'
    ])
    expect(elements(svg, 'g')[0]).toBe('<g transform="matrix(10 0 0 10 16 6)">')
  })

  test('fill stretches its edge pixels past the image, under the image, as the canvas clamps it', () => {
    const svg = imageStroked(IMAGE_STROKE)
    const edges = elements(svg, 'svg').slice(1)
    expect(edges).toHaveLength(8)
    expect(edges[0]).toBe(
      '<svg x="-2" y="0" width="3" height="4" viewBox="0 0 0.5 4" preserveAspectRatio="none">'
    )
    expect(edges[7]).toBe(
      '<svg x="3" y="3" width="3" height="3" viewBox="3.5 3.5 0.5 0.5" preserveAspectRatio="none">'
    )
    expect(svg.lastIndexOf('<svg x=')).toBeLessThan(svg.indexOf('<image id="imgsrc1"'))
    expect(elements(svg, 'use')).toEqual(Array.from({ length: 8 }, () => '<use href="#imgsrc1"/>'))
  })

  test('tile repeats the image at its own period, as the canvas does', () => {
    const svg = imageStroked({ ...IMAGE_STROKE, imageScaleMode: 'TILE', scale: 0.5 })
    expect(elements(svg, 'pattern')).toEqual([
      '<pattern id="img0" patternUnits="userSpaceOnUse" width="2" height="2">'
    ])
    expect(elements(svg, 'use')).toEqual([])
  })

  test('fit draws the image once and nothing past it', () => {
    const svg = imageStroked({ ...IMAGE_STROKE, imageScaleMode: 'FIT' })
    expect(elements(svg, 'svg')).toHaveLength(1)
    expect(elements(svg, 'use')).toEqual([])
    expect(elements(svg, 'image')).toHaveLength(1)
  })

  test('on a straight line, still covers the stroke', () => {
    const line = (graph: SceneGraph, pageId: string) => [
      graph.createNode('LINE', pageId, { width: 100, height: 0, strokes: [IMAGE_STROKE] }).id
    ]
    const svg = imageStroked(IMAGE_STROKE, line)
    expect(elements(svg, 'pattern')[0]).toContain('width="132" height="32"')
  })

  test('draws nothing while its image is missing, as on the canvas', () => {
    const svg = svgOf(strokedRect([IMAGE_STROKE], [{ ...BLACK_STROKE, type: 'SOLID' }]))
    expect(rects(svg)).toEqual(['<rect width="40" height="20" fill="#000000"/>'])
  })

  test('leaves the next stroke to draw while its image is missing', () => {
    const svg = svgOf(strokedRect([IMAGE_STROKE, { ...BLACK_STROKE, weight: 3 }]))
    expect(rects(svg)).toEqual([
      '<rect width="40" height="20" fill="none" stroke="#000000" stroke-width="3"/>'
    ])
  })
})

describe('the strokes a layer has', () => {
  test('a hidden first stroke leaves the gradient after it to draw', () => {
    const svg = svgOf(strokedRect([{ ...BLACK_STROKE, visible: false }, RED_TO_BLUE]))
    expect(rects(svg)[0]).toContain('stroke="url(#grad0)"')
  })

  test('with several, the first visible one is written, as before', () => {
    const svg = svgOf(strokedRect([RED_TO_BLUE, BLACK_STROKE]))
    expect(rects(svg)[0]).toContain('stroke="url(#grad0)" stroke-width="4"')
  })

  test('a gradient with no stops strokes in its color, as the canvas does', () => {
    const bare: Stroke = {
      ...BLACK_STROKE,
      type: 'GRADIENT_LINEAR',
      color: { r: 0, g: 1, b: 0, a: 1 }
    }
    expect(rects(svgOf(strokedRect([bare])))).toEqual([
      '<rect width="40" height="20" fill="none" stroke="#00FF00" stroke-width="2"/>'
    ])
  })

  test('a solid stroke exports as it did', () => {
    const svg = svgOf(strokedRect([{ ...BLACK_STROKE, opacity: 0.5, dashPattern: [2, 1] }]))
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="42" height="22" viewBox="0 0 42 22">\n' +
        '  <g transform="translate(1, 1)">\n' +
        '    <rect width="40" height="20" fill="none" stroke="#000000" stroke-width="2" stroke-opacity="0.5" stroke-dasharray="2 1"/>\n' +
        '  </g>\n' +
        '</svg>'
    )
  })
})
