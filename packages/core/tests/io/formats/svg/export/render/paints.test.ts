import { describe, expect, test } from 'bun:test'

import { makeSceneGraph, firstPageId } from '@open-pencil/test-support/scene'

import { exportSVGOrThrow } from '../helpers'

describe('renderNodesToSVG()', () => {
  test('linear gradient', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
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
    // Figma's identity transform runs from the left edge's middle to the right edge's.
    expect(result).toContain('x1="0" y1="0.5" x2="1" y2="0.5"')
    expect(result).not.toContain('gradientTransform')
    expect(result).toContain('<stop')
    expect(result).toContain('url(#grad')
  })

  test("linear gradient keeps Figma's transform", () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 60,
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
          // Figma's default: top to bottom.
          gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('gradientTransform="matrix(0 1 -1 0 1 0)"')
  })

  test('radial gradient', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
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
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
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
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
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

  test('blend mode', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      blendMode: 'MULTIPLY',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('mix-blend-mode: multiply')
  })

  test('plus lighter blend mode', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      blendMode: 'LINEAR_DODGE',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('mix-blend-mode: plus-lighter')
  })

  test('plus darker blend mode', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 100,
      height: 100,
      blendMode: 'LINEAR_BURN',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('mix-blend-mode: plus-darker')
  })

  test('fill with opacity < 1', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }]
    })
    const result = exportSVGOrThrow(graph, [node.id])
    expect(result).toContain('fill="#FF0000')
  })

  test('inner shadow effect', () => {
    const graph = makeSceneGraph('Page 1')
    const node = graph.createNode('RECTANGLE', firstPageId(graph), {
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
