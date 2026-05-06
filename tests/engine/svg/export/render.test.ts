import { describe, expect, test } from 'bun:test'

import { exportSVG, exportSVGOrThrow, makeGraph, pageId, renderNodesToSVGOrThrow } from './helpers'

// --- Full SVG export tests ---

describe('renderNodesToSVG()', () => {
  test('returns null for empty selection', () => {
    const graph = makeGraph()
    expect(exportSVG(graph, [])).toBeNull()
  })

  test('returns null for hidden nodes', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 50,
      visible: false
    })
    expect(exportSVG(graph, [node.id])).toBeNull()
  })

  test('basic rectangle', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const withDecl = renderNodesToSVGOrThrow(graph, pageId(graph), [node.id], {
      xmlDeclaration: true
    })
    const withoutDecl = renderNodesToSVGOrThrow(graph, pageId(graph), [node.id], {
      xmlDeclaration: false
    })
    expect(withDecl).toStartWith('<?xml')
    expect(withoutDecl).toStartWith('<svg')
  })

  test('ellipse', () => {
    const graph = makeGraph()
    const node = graph.createNode('ELLIPSE', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('LINE', pageId(graph), {
      width: 100,
      height: 0,
      strokes: [
        {
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
    const graph = makeGraph()
    const node = graph.createNode('STAR', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 100,
      height: 100,
      pointCount: 6,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<polygon')
  })

  test('rounded rectangle', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
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
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      opacity: 0.5,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('opacity="0.5"')
  })

  test('rotation', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 50,
      rotation: 45,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('rotate(45,')
  })

  test('stroke with dash pattern', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
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
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
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

  test('frame with children', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
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
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
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

  test('hidden children excluded', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
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

  test('linear gradient', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<linearGradient')
    expect(result).toContain('<stop')
    expect(result).toContain('url(#grad')
  })

  test('radial gradient', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_RADIAL',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0.5, m10: 0, m11: 1, m12: 0.5 }
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<radialGradient')
    expect(result).toContain('url(#grad')
  })

  test('drop shadow effect', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<filter')
    expect(result).toContain('<feDropShadow')
    expect(result).toContain('dy="4"')
    expect(result).toContain('filter="url(#fx')
  })

  test('layer blur effect', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0,
          visible: true
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<feGaussianBlur')
    expect(result).toContain('stdDeviation="5"')
  })

  test('multiple nodes', () => {
    const graph = makeGraph()
    const a = graph.createNode('RECTANGLE', pageId(graph), {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const b = graph.createNode('ELLIPSE', pageId(graph), {
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

  test('blend mode', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      blendMode: 'MULTIPLY',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('mix-blend-mode: multiply')
  })

  test('fill with opacity < 1', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('fill="#FF0000')
  })

  test('component and instance treated as containers', () => {
    const graph = makeGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
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
    const graph = makeGraph()
    const section = graph.createNode('SECTION', pageId(graph), {
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

  test('flip transforms', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 50,
      flipX: true,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('scale(-1, 1)')
  })

  test('stroke opacity', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        {
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

  test('no fill no stroke produces no output for groups', () => {
    const graph = makeGraph()
    const group = graph.createNode('GROUP', pageId(graph), {
      width: 100,
      height: 100
    })
    const result = exportSVG(graph, [group.id])
    expect(result).toBeNull()
  })

  test('group with children', () => {
    const graph = makeGraph()
    const group = graph.createNode('GROUP', pageId(graph), {
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

  test('inner shadow effect', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 2, y: 2 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('<filter')
    expect(result).toContain('<feGaussianBlur')
    expect(result).toContain('<feComposite')
  })
})
