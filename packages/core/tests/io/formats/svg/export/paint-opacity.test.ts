import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG, renderSVGNode } from '@open-pencil/core/io/formats/svg'
import { parsePenFile } from '@open-pencil/pen'
import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { renderNodeSVGElement } from '#core/io/formats/svg/export'

import { moveTo, paths, rects, solid, svgOf } from './helpers'

// Solid fill opacity is a paint attribute. Baking it into the layer would also fade strokes.
describe('solid paint opacity exported to SVG', () => {
  test('keeps sRGB fill opacities and leaves a fully opaque fill unchanged', () => {
    const build = (graph: SceneGraph, pageId: string) => {
      const frame = graph.createNode('FRAME', pageId, { width: 120, height: 40 })
      for (const [index, opacity] of [0, 0.4, 1].entries()) {
        graph.createNode('RECTANGLE', frame.id, {
          x: index * 40,
          width: 40,
          height: 40,
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity, visible: true }]
        })
      }
      return [frame.id]
    }

    expect(rects(svgOf(build, { colorSpace: 'srgb' }))).toEqual([
      '<rect width="40" height="40" fill="#000000" fill-opacity="0"/>',
      '<rect width="40" height="40" fill="#000000" fill-opacity="0.4"/>',
      '<rect width="40" height="40" fill="#000000"/>'
    ])
    expect(rects(svgOf(build, { colorSpace: 'display-p3' }))).toEqual([
      '<rect width="40" height="40" fill="color(display-p3 0 0 0 / 0)"/>',
      '<rect width="40" height="40" fill="color(display-p3 0 0 0 / 0.4)"/>',
      '<rect width="40" height="40" fill="color(display-p3 0 0 0)"/>'
    ])
  })

  test('paints a solid fill at its opacity, which replaces color alpha', () => {
    const build = (graph: SceneGraph, pageId: string) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [solid(0, 0, 0, 0.5, 0.5)]
      }).id
    ]
    // `.pen` stores one hex alpha in both fields. The product would export 0.25.
    expect(rects(svgOf(build))).toEqual([
      '<rect width="40" height="40" fill="#000000" fill-opacity="0.5"/>'
    ])
    expect(rects(svgOf(build, { colorSpace: 'display-p3' }))).toEqual([
      '<rect width="40" height="40" fill="color(display-p3 0 0 0 / 0.5)"/>'
    ])

    const colorAlphaOnly = svgOf((graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [solid(0, 0, 0, 0.5, 1)]
      }).id
    ])
    expect(rects(colorAlphaOnly)).toEqual(['<rect width="40" height="40" fill="#000000"/>'])
  })

  test('fades the fill without fading an opaque stroke', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.4, visible: true }],
        strokes: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            weight: 1,
            align: 'CENTER'
          }
        ]
      }).id
    ])
    expect(svg).toContain(
      '<rect width="40" height="40" fill="#000000" fill-opacity="0.4" stroke="#FF0000" stroke-width="1"/>'
    )
    expect(svg).not.toMatch(/(^|\s)opacity="/)
  })

  test('keeps each fill opacity when a shape has more than one', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.4, visible: true },
          { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }
        ],
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 0.5,
            visible: true,
            weight: 2,
            align: 'CENTER'
          }
        ]
      }).id
    ])
    expect(rects(svg)).toEqual([
      '<rect width="40" height="40" fill="#FF0000" fill-opacity="0.4"/>',
      '<rect width="40" height="40" fill="#0000FF" stroke="#000000" stroke-width="2" stroke-opacity="0.5"/>'
    ])
  })

  test('keeps stroke opacity and drops color alpha the canvas replaces', () => {
    const stroke = (graph: SceneGraph, pageId: string, color: Stroke['color'], opacity: number) =>
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        strokes: [{ type: 'SOLID', color, opacity, visible: true, weight: 2, align: 'CENTER' }]
      }).id

    const partial = svgOf((graph, pageId) => [
      stroke(graph, pageId, { r: 0, g: 0, b: 0, a: 1 }, 0.4)
    ])
    expect(partial).toContain(
      '<rect width="40" height="40" fill="none" stroke="#000000" stroke-width="2" stroke-opacity="0.4"/>'
    )

    const colorAlpha = svgOf((graph, pageId) => [
      stroke(graph, pageId, { r: 0, g: 0, b: 0, a: 0.5 }, 1)
    ])
    expect(colorAlpha).toContain(
      '<rect width="40" height="40" fill="none" stroke="#000000" stroke-width="2"/>'
    )

    const both = svgOf((graph, pageId) => [
      stroke(graph, pageId, { r: 0, g: 0, b: 0, a: 0.5 }, 0.4)
    ])
    expect(both).toContain(
      '<rect width="40" height="40" fill="none" stroke="#000000" stroke-width="2" stroke-opacity="0.4"/>'
    )

    // Display P3 leaves the color opaque so a viewer does not multiply it by stroke-opacity.
    const p3 = svgOf(
      (graph, pageId) => [stroke(graph, pageId, { r: 0, g: 0, b: 0, a: 0.5 }, 0.4)],
      { colorSpace: 'display-p3' }
    )
    expect(p3).toContain(
      '<rect width="40" height="40" fill="none" stroke="color(display-p3 0 0 0)" stroke-width="2" stroke-opacity="0.4"/>'
    )
  })

  test('keeps text fill opacity, and an opaque run does not inherit it', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, {
        text: 'Ab',
        width: 40,
        height: 20,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.4, visible: true }],
        styleRuns: [
          { start: 0, length: 1, style: {} },
          {
            start: 1,
            length: 1,
            style: {
              fills: [
                { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
              ]
            }
          }
        ]
      }).id
    ])
    expect(svg).toContain(
      '<text x="0" y="14" font-family="Inter" font-size="14" fill="#000000" fill-opacity="0.4" xml:space="preserve"><tspan>A</tspan><tspan fill="#FF0000" fill-opacity="1">b</tspan></text>'
    )
  })

  test('multiplies a character fill color alpha by its opacity', () => {
    const build = (graph: SceneGraph, pageId: string) => [
      graph.createNode('TEXT', pageId, {
        text: 'Ab',
        width: 40,
        height: 20,
        fills: [solid(0, 0, 0, 1, 1)],
        styleRuns: [
          { start: 0, length: 1, style: {} },
          {
            start: 1,
            length: 1,
            style: { fills: [solid(0, 0, 0, 0.5, 0.4)] }
          }
        ]
      }).id
    ]

    expect(svgOf(build)).toContain('<tspan fill="#000000" fill-opacity="0.2">b</tspan>')
    expect(svgOf(build, { colorSpace: 'display-p3' })).toContain(
      '<tspan fill="color(display-p3 0 0 0 / 0.2)">b</tspan>'
    )
  })

  test('exports a .pen #00000080 fill and stroke at that alpha once', () => {
    const graph = parsePenFile(
      JSON.stringify({
        version: '2.21',
        children: [
          {
            id: 'mark',
            type: 'rectangle',
            width: 40,
            height: 40,
            fill: '#00000080',
            stroke: '#00000080',
            strokeWidth: 2
          }
        ]
      })
    )
    const node = expectDefined(graph.getNode('mark'), 'imported rectangle')
    const alpha = 128 / 255
    expect(node.fills[0]).toMatchObject({ opacity: alpha, color: { a: alpha } })
    expect(node.strokes[0]).toMatchObject({ opacity: alpha, color: { a: alpha } })

    const pageId = graph.getPages()[0].id
    const svg = expectDefined(
      renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false }),
      'SVG output'
    )
    expect(svg).toContain(
      '<rect width="40" height="40" fill="#000000" fill-opacity="0.5" stroke="#000000" stroke-width="2" stroke-opacity="0.5"/>'
    )
    expect(svg).not.toContain('0.25')

    const p3 = expectDefined(
      renderNodesToSVG(graph, pageId, [node.id], {
        xmlDeclaration: false,
        colorSpace: 'display-p3'
      }),
      'Display P3 SVG output'
    )
    expect(p3).toContain(
      '<rect width="40" height="40" fill="color(display-p3 0 0 0 / 0.5)" stroke="color(display-p3 0 0 0)" stroke-width="2" stroke-opacity="0.5"/>'
    )
    expect(p3).not.toContain('0.25')
  })

  test('keeps a tinted solid fill opacity beside currentColor in Display P3', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', pageId, {
      width: 40,
      height: 40,
      fills: [solid(0, 0, 0, 1, 0.4)]
    })
    const element = (colorSpace: 'srgb' | 'display-p3', tinted: boolean) => {
      const drawn = expectDefined(
        renderNodeSVGElement(graph, node, {
          idPrefix: 'n-',
          colorSpace,
          tint: tinted ? () => ['fill'] : undefined
        }),
        'SVG element'
      )
      return renderSVGNode(drawn)
    }

    expect(element('display-p3', true)).toContain('fill="currentColor" fill-opacity="0.4"')
    // Untinted Display P3 still carries the alpha in the color and omits fill-opacity.
    const plain = element('display-p3', false)
    expect(plain).toContain('fill="color(display-p3 0 0 0 / 0.4)"')
    expect(plain).not.toContain('fill-opacity')
    expect(element('srgb', true)).toContain('fill="currentColor" fill-opacity="0.4"')

    // An opaque tint, such as an icon path, stays currentColor without an extra fill-opacity.
    const opaque = graph.createNode('RECTANGLE', pageId, {
      width: 40,
      height: 40,
      fills: [solid(0, 0, 0, 1, 1)]
    })
    const opaqueSVG = renderSVGNode(
      expectDefined(
        renderNodeSVGElement(graph, opaque, {
          idPrefix: 'n-',
          colorSpace: 'display-p3',
          tint: () => ['fill']
        }),
        'opaque SVG element'
      )
    )
    expect(opaqueSVG).toContain('fill="currentColor"')
    expect(opaqueSVG).not.toContain('fill-opacity')
  })

  test("keeps each region's own fills of a vector, translucent and opaque", () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 40,
        height: 40,
        vectorNetwork: {
          vertices: [],
          segments: [],
          regions: [
            {
              windingRule: 'NONZERO',
              loops: [],
              fills: [solid(0, 0, 0, 0.5, 0.5), solid(0, 0, 1, 1, 1)]
            },
            { windingRule: 'NONZERO', loops: [], fills: [solid(1, 0, 0, 1, 0.4)] }
          ]
        },
        // Fill geometry is one outline per region.
        fillGeometry: [
          { windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) },
          { windingRule: 'NONZERO', commandsBlob: moveTo(10, 0) }
        ]
      }).id
    ])
    expect(paths(svg)).toEqual([
      '<path d="M0 0" fill="#000000" fill-opacity="0.5" stroke="none"/>',
      '<path d="M0 0" fill="#0000FF"/>',
      '<path d="M10 0" fill="#FF0000" fill-opacity="0.4"/>'
    ])
  })

  test("draws a pasted vector's regions from its network when it has no fill geometry", () => {
    const zero = { x: 0, y: 0 }
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        fills: [solid(0.5, 0.5, 0.5, 1, 1)],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
            { start: 1, end: 2, tangentStart: zero, tangentEnd: zero },
            { start: 2, end: 0, tangentStart: zero, tangentEnd: zero }
          ],
          regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: [solid(1, 0, 0, 1, 1)] }]
        }
      }).id
    ])
    expect(paths(svg)).toEqual(['<path d="M0 0L10 0L0 10L0 0Z" fill="#FF0000"/>'])
  })

  test("traces a vector's painted regions when its fill geometry has fewer outlines", () => {
    const zero = { x: 0, y: 0 }
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        fills: [solid(0.5, 0.5, 0.5, 1, 1)],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
            { start: 1, end: 2, tangentStart: zero, tangentEnd: zero },
            { start: 2, end: 0, tangentStart: zero, tangentEnd: zero },
            { start: 1, end: 3, tangentStart: zero, tangentEnd: zero },
            { start: 3, end: 2, tangentStart: zero, tangentEnd: zero }
          ],
          regions: [
            { windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: [solid(1, 0, 0, 1, 1)] },
            { windingRule: 'NONZERO', loops: [[3, 4, 1]], fills: [solid(0, 0, 1, 1, 1)] }
          ]
        },
        // An import skipped the second region's empty outline.
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) }]
      }).id
    ])
    expect(paths(svg)).toEqual([
      '<path d="M0 0L10 0L0 10L0 0Z" fill="#FF0000"/>',
      '<path d="M10 0L10 10L0 10L10 0Z" fill="#0000FF"/>'
    ])
  })
})
