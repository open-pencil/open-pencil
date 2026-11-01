import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import {
  renderNodesToSVG,
  renderSVGNode,
  type SVGExportOptions
} from '@open-pencil/core/io/formats/svg'
import { parsePenFile } from '@open-pencil/pen'
import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import { outlineSVGPath } from '@open-pencil/scene-graph/polygon'
import { shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'

import { renderNodeSVGElement } from '#core/io/formats/svg/export'

/** The attributes of the `<line>` an SVG export writes for a line with a 6 px black stroke. */
function exportedLine(
  props: Partial<SceneNode>,
  stroke: Partial<Stroke> = {}
): Map<string, string> {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const line = graph.createNode('LINE', page, {
    width: 300,
    height: 0,
    strokeWeight: 6,
    ...props,
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 6,
        align: 'CENTER',
        ...stroke
      }
    ]
  })
  const svg = expectDefined(renderNodesToSVG(graph, page, [line.id]), 'SVG output')
  const element = expectDefined(/<line\b([^>]*)>/.exec(svg), 'line element')[1]
  return new Map(
    Array.from(element.matchAll(/([\w-]+)="([^"]*)"/g), ([, name, value]) => [name, value])
  )
}

// The canvas strokes a line as Figma 126 does; its export draws the same.
describe('a line exported to SVG', () => {
  test('takes its cap from the layer when the stroke has none, pulled in to end with the line', () => {
    const line = exportedLine({ strokeCap: 'ROUND' })
    expect(line.get('stroke-linecap')).toBe('round')
    expect(line.get('x1')).toBe('3')
    expect(line.get('x2')).toBe('297')
    expect(line.get('y1')).toBe('-3')
  })

  test('stretches its dashes to whole periods, with half a dash at each end', () => {
    // Dashes of 10 and gaps of 5 fit 20 times into 300 and 7 times, stretched, into 100: Figma's
    // stroke geometry for the 100 px line starts with a dash from 0 to 4.7619, which SVG rounds.
    const long = exportedLine({}, { dashPattern: [10, 5] })
    expect(long.get('stroke-dasharray')).toBe('10 5')
    expect(long.get('stroke-dashoffset')).toBe('5')
    const short = exportedLine({ width: 100 }, { dashPattern: [10, 5] })
    expect(Number(short.get('stroke-dashoffset'))).toBeCloseTo(4.7619, 1)
  })
})

function svgOf(
  build: (graph: SceneGraph, pageId: string) => string[],
  options: SVGExportOptions = {}
): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  return expectDefined(
    renderNodesToSVG(graph, pageId, build(graph, pageId), { xmlDeclaration: false, ...options }),
    'SVG output'
  )
}

function rects(svg: string): string[] {
  return Array.from(svg.matchAll(/<rect\b[^>]*>/g), ([element]) => element)
}

function paths(svg: string): string[] {
  return Array.from(svg.matchAll(/<path\b[^>]*>/g), ([element]) => element)
}

/** A move command, enough for a vector geometry to export as a path. */
function moveTo(x: number, y: number): Uint8Array {
  const blob = new Uint8Array(9)
  blob[0] = 1
  const view = new DataView(blob.buffer)
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return blob
}

function solid(r: number, g: number, b: number, a: number, opacity: number): Fill {
  return { type: 'SOLID', color: { r, g, b, a }, opacity, visible: true }
}

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

describe('FigJam shapes exported to SVG', () => {
  const stroke: Stroke = {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 2,
    opacity: 1,
    visible: true,
    align: 'CENTER'
  }

  /** The SVG a page holding one FigJam shape of `type`, outlined in black, exports to. */
  function exportedShape(shapeWithTextType: SceneNode['shapeWithTextType']) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const shape = createShapeWithText(
      graph,
      page,
      { shapeWithTextType, width: 120, height: 80, strokes: [stroke] },
      {}
    )
    return { shape, svg: expectDefined(renderNodesToSVG(graph, page, [shape.id])) }
  }

  test('draw their own outline, not a box', () => {
    const { shape, svg } = exportedShape('DIAMOND')
    const outline = outlineSVGPath(
      shapeWithTextGeometry('DIAMOND', shape.width, shape.height, shape.cornerRadius).outline,
      (value) => Math.round(value * 100) / 100
    )
    expect(svg).toContain(`d="${outline}"`)
    expect(svg).not.toContain('<rect')
  })

  test('stroke their inner lines inside the outline, as a database’s front rim', () => {
    const { svg } = exportedShape('ENG_DATABASE')
    const rim = expectDefined(
      svg.match(/<path d="[^"]+" fill="none"[^>]*clip-path="url\(#([^)]+)\)"/)
    )
    expect(svg).toContain(`<clipPath id="${rim[1]}">`)
    expect(exportedShape('DIAMOND').svg).not.toContain('clip-path')
  })
})
