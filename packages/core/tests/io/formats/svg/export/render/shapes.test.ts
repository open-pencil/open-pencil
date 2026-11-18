import { describe, expect, test } from 'bun:test'

import { makeSceneGraph, firstPageId } from '@open-pencil/test-support/scene'

import { exportSVG, exportSVGOrThrow, renderNodesToSVGOrThrow } from '../helpers'

describe('renderNodesToSVG()', () => {
  test('returns null for empty selection', () => {
    const graph = makeSceneGraph('Page 1')
    expect(exportSVG(graph, [])).toBeNull()
  })

  test('returns null for hidden nodes', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 50,
      visible: false
    })
    expect(exportSVG(graph, [node.id])).toBeNull()
  })

  test('basic rectangle', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<svg')
    expect(result).toContain('width="100"')
    expect(result).toContain('height="50"')
    expect(result).toContain('viewBox="0 0 100 50"')
    expect(result).toContain('<rect')
    expect(result).toContain('fill="#FF0000"')
  })

  test('xml declaration', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const withDecl = renderNodesToSVGOrThrow(graph, firstPageId(graph), [node.id], {
      xmlDeclaration: true
    })
    const withoutDecl = renderNodesToSVGOrThrow(graph, firstPageId(graph), [node.id], {
      xmlDeclaration: false
    })
    expect(withDecl).toStartWith('<?xml')
    expect(withoutDecl).toStartWith('<svg')
  })

  test('ellipse', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('ELLIPSE', firstPageId(graph), {
      width: 80,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<ellipse')
    expect(result).toContain('cx="40"')
    expect(result).toContain('cy="30"')
    expect(result).toContain('rx="40"')
    expect(result).toContain('ry="30"')
  })

  test('line', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('LINE', firstPageId(graph), {
      width: 100,
      height: 0,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'CENTER' as const
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<line')
    expect(result).toContain('x2="100"')
    expect(result).toContain('stroke-width="2"')
  })

  test('star', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('STAR', firstPageId(graph), {
      width: 100,
      height: 100,
      pointCount: 5,
      starInnerRadius: 0.382,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<polygon')
    expect(result).toContain('points="')
  })

  test('polygon', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('POLYGON', firstPageId(graph), {
      width: 100,
      height: 100,
      pointCount: 6,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<polygon')
  })

  test('rounded rectangle', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 200,
      height: 100,
      cornerRadius: 16,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('rx="16"')
    expect(result).toContain('ry="16"')
  })

  test('independent corners produce path', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 50,
      cornerRadius: 10,
      independentCorners: true,
      topLeftRadius: 10,
      topRightRadius: 0,
      bottomRightRadius: 20,
      bottomLeftRadius: 5,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<path')
    expect(result).toContain('d="M10 0')
  })

  test('text node', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('TEXT', firstPageId(graph), {
      width: 200,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontWeight: 700,
      fontFamily: 'Inter',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<text')
    expect(result).toContain('font-size="18"')
    expect(result).toContain('font-weight="700"')
    expect(result).toContain('font-family="Inter"')
    expect(result).toContain('>Hello World</text>')
  })

  test('rtl text node exports direction and logical anchor', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('TEXT', firstPageId(graph), {
      width: 180,
      height: 24,
      text: 'مرحبا',
      fontSize: 18,
      textDirection: 'RTL',
      textAlignHorizontal: 'LEFT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('direction="rtl"')
    expect(result).toContain('text-anchor="end"')
    expect(result).toContain('x="180"')
  })

  test('text with style runs', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('TEXT', firstPageId(graph), {
      width: 200,
      height: 24,
      text: 'Hello Bold',
      fontSize: 14,
      fontFamily: 'Inter',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      styleRuns: [
        { start: 0, length: 6, style: {} },
        { start: 6, length: 4, style: { fontWeight: 700 } }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<tspan')
    expect(result).toContain('font-weight="700"')
  })

  test('opacity', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 50,
      height: 50,
      opacity: 0.5,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('opacity="0.5"')
  })

  test('rotation', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 50,
      rotation: 45,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('rotate(45,')
  })

  test('stroke with dash pattern', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'CENTER' as const,
          dashPattern: [5, 3]
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('stroke-dasharray="5 3"')
  })

  test('stroke cap and join', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 3,
          opacity: 1,
          visible: true,
          align: 'CENTER' as const,
          cap: 'ROUND',
          join: 'BEVEL'
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('stroke-linecap="round"')
    expect(result).toContain('stroke-linejoin="bevel"')
  })

  test('multiple nodes', () => {
    const graph = makeSceneGraph('Page 1')
    const a = graph.createNode('RECTANGLE', firstPageId(graph), {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const b = graph.createNode('ELLIPSE', firstPageId(graph), {
      x: 60,
      y: 0,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [a.id, b.id])
    expect(result).toContain('viewBox="0 0 100 50"')
    expect(result).toContain('<rect')
    expect(result).toContain('<ellipse')
  })

  test('flip transforms', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 50,
      flipX: true,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('scale(-1, 1)')
  })

  test('stroke opacity', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 1,
          opacity: 0.5,
          visible: true,
          align: 'CENTER' as const
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('stroke-opacity="0.5"')
  })
})
