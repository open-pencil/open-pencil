import { describe, expect, test } from 'bun:test'

import { makeSceneGraph, firstPageId } from '@open-pencil/test-support/scene'

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
})
