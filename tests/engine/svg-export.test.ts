import { describe, expect, test } from 'bun:test'

import {
  SceneGraph,
  renderNodesToSVG,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  svg,
  renderSVGNode
} from '@verso/core'

function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function exportSVG(graph: SceneGraph, nodeIds: string[], xmlDecl = false): string | null {
  return renderNodesToSVG(graph, pageId(graph), nodeIds, { xmlDeclaration: xmlDecl })
}

// --- SVGNode builder tests ---

describe('svg() and renderSVGNode()', () => {
  test('self-closing element', () => {
    const node = svg('rect', { width: 100, height: 50 })
    expect(renderSVGNode(node)).toBe('<rect width="100" height="50"/>')
  })

  test('element with text child', () => {
    const node = svg('text', { x: 10 }, 'Hello')
    expect(renderSVGNode(node)).toBe('<text x="10">Hello</text>')
  })

  test('nested elements', () => {
    const node = svg('g', { id: 'group' }, svg('rect', { width: 10, height: 10 }))
    const result = renderSVGNode(node)
    expect(result).toContain('<g id="group">')
    expect(result).toContain('  <rect width="10" height="10"/>')
    expect(result).toContain('</g>')
  })

  test('filters null/undefined attrs', () => {
    const node = svg('rect', { width: 100, fill: undefined, stroke: null })
    expect(renderSVGNode(node)).toBe('<rect width="100"/>')
  })

  test('filters null/undefined/false children', () => {
    const node = svg('g', {}, null, false, svg('rect', {}), undefined)
    const result = renderSVGNode(node)
    expect(result).toContain('<rect/>')
  })

  test('escapes attribute values', () => {
    const node = svg('text', { 'data-info': 'a"b<c' })
    expect(renderSVGNode(node)).toContain('data-info="a&quot;b&lt;c"')
  })

  test('escapes text content', () => {
    const node = svg('text', {}, '1 < 2 & 3 > 0')
    expect(renderSVGNode(node)).toBe('<text>1 &lt; 2 &amp; 3 &gt; 0</text>')
  })
})

// --- geometryBlobToSVGPath tests ---

describe('geometryBlobToSVGPath()', () => {
  function makeBlob(commands: number[]): Uint8Array {
    const buf = new ArrayBuffer(commands.length)
    const view = new DataView(buf)
    let o = 0
    for (const cmd of commands) {
      view.setUint8(o++, cmd)
    }
    return new Uint8Array(buf)
  }

  function makeBlobWithFloats(ops: Array<{ cmd: number; floats?: number[] }>): Uint8Array {
    let size = 0
    for (const op of ops) {
      size += 1 + (op.floats?.length ?? 0) * 4
    }
    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    let o = 0
    for (const op of ops) {
      view.setUint8(o, op.cmd)
      o += 1
      if (op.floats) {
        for (const f of op.floats) {
          view.setFloat32(o, f, true)
          o += 4
        }
      }
    }
    return new Uint8Array(buf)
  }

  test('empty blob', () => {
    expect(geometryBlobToSVGPath(new Uint8Array(0))).toBe('')
  })

  test('move + line + close', () => {
    const blob = makeBlobWithFloats([
      { cmd: 1, floats: [10, 20] },
      { cmd: 2, floats: [30, 40] },
      { cmd: 0 }
    ])
    expect(geometryBlobToSVGPath(blob)).toBe('M10 20L30 40Z')
  })

  test('cubic bezier', () => {
    const blob = makeBlobWithFloats([
      { cmd: 1, floats: [0, 0] },
      { cmd: 4, floats: [10, 0, 20, 10, 30, 30] },
      { cmd: 0 }
    ])
    const result = geometryBlobToSVGPath(blob)
    expect(result).toContain('M0 0')
    expect(result).toContain('C10 0 20 10 30 30')
    expect(result).toContain('Z')
  })
})

// --- vectorNetworkToSVGPaths tests ---

describe('vectorNetworkToSVGPaths()', () => {
  test('single straight segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: []
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('L100 100')
  })

  test('curved segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 50 },
          tangentEnd: { x: 0, y: 50 }
        }
      ],
      regions: []
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('C')
  })

  test('region with loop', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('Z')
  })

  test('empty network', () => {
    const paths = vectorNetworkToSVGPaths({ vertices: [], segments: [], regions: [] })
    expect(paths).toHaveLength(0)
  })
})

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
    const result = exportSVG(graph, [node.id])!
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
    const withDecl = renderNodesToSVG(graph, pageId(graph), [node.id], { xmlDeclaration: true })!
    const withoutDecl = renderNodesToSVG(graph, pageId(graph), [node.id], {
      xmlDeclaration: false
    })!
    expect(withDecl).toStartWith('<?xml')
    expect(withoutDecl).toStartWith('<svg')
  })

  test('ellipse', () => {
    const graph = makeGraph()
    const node = graph.createNode('ELLIPSE', pageId(graph), {
      width: 80,
      height: 60,
      fills: [
        { type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
    expect(result).toContain('<text')
    expect(result).toContain('font-size="18"')
    expect(result).toContain('font-weight="700"')
    expect(result).toContain('font-family="Inter"')
    expect(result).toContain('>Hello World</text>')
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [frame.id])!
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
    const result = exportSVG(graph, [frame.id])!
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
    const result = exportSVG(graph, [frame.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [a.id, b.id])!
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
    const result = exportSVG(graph, [node.id])!
    expect(result).toContain('mix-blend-mode: multiply')
  })

  test('fill with opacity < 1', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }
      ]
    })
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [comp.id])!
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
    const result = exportSVG(graph, [section.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [node.id])!
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
    const result = exportSVG(graph, [group.id])!
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
    const result = exportSVG(graph, [node.id])!
    expect(result).toContain('<filter')
    expect(result).toContain('<feGaussianBlur')
    expect(result).toContain('<feComposite')
  })
})
