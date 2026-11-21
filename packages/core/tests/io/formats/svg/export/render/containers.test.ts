import { describe, expect, test } from 'bun:test'

import { makeSceneGraph, firstPageId } from '@open-pencil/test-support/scene'

import { createSVGNodes, renderNodesToSVG } from '#core/io/formats/svg'
import { boxOutlinePath } from '#core/io/formats/svg/paths'

import { exportSVG, exportSVGOrThrow } from '../helpers'

describe('renderNodesToSVG()', () => {
  test('frame with children', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      name: 'Card',
      width: 200,
      height: 150,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 180,
      height: 100,
      x: 10,
      y: 10,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toContain('<g')
    expect(result).toContain('translate(10, 10)')
  })

  test('frame with clipsContent', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 100,
      clipsContent: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 200,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toContain('<clipPath')
    expect(result).toContain('clip-path="url(#clip')
  })

  test('rounded frame clips its children to its rounded corners', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 40,
      cornerRadius: 8,
      clipsContent: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      y: 39,
      width: 100,
      height: 1,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toMatch(
      /<clipPath id="clip[^"]*">\s*<rect width="100" height="40" rx="8" ry="8"/
    )
  })

  test('rounded frame keeps a radius past its shorter side circular', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 10,
      cornerRadius: 20,
      clipsContent: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, { width: 100, height: 10 })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toMatch(
      /<clipPath id="clip[^"]*">\s*<rect width="100" height="10" rx="5" ry="5"/
    )
    expect(result).not.toContain('rx="20"')
  })

  test('frame with independent corners clips its children to its outline', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 40,
      independentCorners: true,
      topLeftRadius: 8,
      bottomRightRadius: 4,
      clipsContent: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toMatch(/<clipPath id="clip[^"]*">\s*<path d="M8 0L100 0L100 36A4 4 0 0 1 96 40/)
  })

  test('smoothed frame fills, strokes, and clips its children along one smoothed outline', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 40,
      cornerRadius: 16,
      cornerSmoothing: 0.6,
      clipsContent: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'INSIDE'
        }
      ]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const outline = boxOutlinePath(frame)
    const result = exportSVGOrThrow(graph, [frame.id])
    const d = `d="${outline}"`
    // The children's clip, the inside stroke's clip, the fill, and the stroke.
    expect(result.split(d).length - 1).toBe(4)
    expect(result).toContain(`<path ${d} fill="#FFFFFF"/>`)
    expect(result).toContain(`<clipPath id="clip0">\n      <path ${d}/>`)
    expect(result).toMatch(/<g clip-path="url\(#clip0\)">\s*<rect width="100" height="40"/)
    expect(result).not.toContain('rx="16"')
  })

  test('hidden children excluded', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Visible',
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Hidden',
      width: 50,
      height: 50,
      visible: false,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toContain('fill="#FF0000"')
    expect(result).not.toContain('fill="#0000FF"')
  })

  test('component and instance treated as containers', () => {
    const graph = makeSceneGraph('Page 1')
    const comp = graph.createNode('COMPONENT', firstPageId(graph), {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', comp.id, {
      width: 80,
      height: 80,
      x: 10,
      y: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [comp.id])
    expect(result).toContain('<rect')
    expect(result).toContain('translate(10, 10)')
  })

  test('section node', () => {
    const graph = makeSceneGraph('Page 1')
    const section = graph.createNode('SECTION', firstPageId(graph), {
      width: 500,
      height: 300,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const result = exportSVGOrThrow(graph, [section.id])
    expect(result).toContain('<rect')
    expect(result).toContain('width="500"')
  })

  test('no fill no stroke produces no output for groups', () => {
    const graph = makeSceneGraph('Page 1')
    const group = graph.createNode('GROUP', firstPageId(graph), {
      width: 100,
      height: 100
    })
    const result = exportSVG(graph, [group.id])
    expect(result).toBeNull()
  })

  test('group with children', () => {
    const graph = makeSceneGraph('Page 1')
    const group = graph.createNode('GROUP', firstPageId(graph), {
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', group.id, {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [group.id])
    expect(result).toContain('<rect')
    expect(result).toContain('fill="#FF0000"')
  })

  test('imported clipPath mask clips subsequent content without painting the mask (#2274)', () => {
    const graph = makeSceneGraph('Page 1')
    const pageId = firstPageId(graph)
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30">
  <defs><clipPath id="window"><rect width="20" height="20"/></clipPath></defs>
  <rect width="60" height="30" fill="#ffffff"/>
  <g clip-path="url(#window)"><rect x="10" width="35" height="20" fill="#ff0000"/></g>
</svg>`
    const frame = createSVGNodes(graph, pageId, source)
    if (!frame) throw new Error('Expected imported frame')
    const result = renderNodesToSVG(graph, pageId, [frame.id], {
      useAbsoluteBounds: true,
      xmlDeclaration: false
    })
    if (!result) throw new Error('Expected exported SVG')
    expect(result).toContain('<mask id="mask1" style="mask-type:alpha" maskUnits="userSpaceOnUse"')
    expect(result).toContain('<g mask="url(#mask1)">')
    // Mask path is defined inside <defs><mask>, never painted in the body alongside #FF0000.
    const body = result.split('</defs>')[1] ?? ''
    expect(body).not.toContain('fill="#000000"')
    expect(body).toContain('fill="#FF0000"')
  })

  test('mask runs honor visibility, trailing masks, and maskType modes', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = graph.createNode('FRAME', firstPageId(graph), {
      width: 100,
      height: 100
    })
    // Before first mask: unmasked
    graph.createNode('RECTANGLE', frame.id, {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    // Hidden mask: ignored
    graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      isMask: true,
      visible: false,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    // VECTOR mask with partial fill opacity becomes opaque in <mask>
    graph.createNode('RECTANGLE', frame.id, {
      width: 30,
      height: 30,
      isMask: true,
      maskType: 'VECTOR',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.25 }, opacity: 0.25, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    // LUMINANCE mask starts a second run
    graph.createNode('RECTANGLE', frame.id, {
      width: 50,
      height: 50,
      isMask: true,
      maskType: 'LUMINANCE',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 60,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    // Trailing mask with no masked siblings draws nothing
    graph.createNode('RECTANGLE', frame.id, {
      width: 70,
      height: 70,
      isMask: true,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])
    expect(result).toContain(
      'style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="30" height="30"'
    )
    expect(result).toContain(
      'style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="50" height="50"'
    )
    expect(result).not.toContain('fill-opacity="0.25"')
    expect(result).not.toContain('width="70"')
    expect(result).toContain('fill="#00FF00"')
    expect(result).toContain('<g mask="url(#mask0)">')
    expect(result).toContain('<g mask="url(#mask1)">')
  })
})
