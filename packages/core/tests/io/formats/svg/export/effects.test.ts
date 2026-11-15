import { describe, expect, test } from 'bun:test'

import type { ExportEffectWarning } from '@open-pencil/core/io/formats/svg'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { SceneGraph as Graph } from '@open-pencil/scene-graph'
import { polygonBlob } from '@open-pencil/test-support/geometry'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

import { svgOf } from './helpers'

const io = new IORegistry(BUILTIN_IO_FORMATS)

const BLACK_50 = { r: 0, g: 0, b: 0, a: 0.5 }

function effect(type: Effect['type'], props: Partial<Effect> = {}): Effect {
  return {
    type,
    color: BLACK_50,
    offset: { x: 0, y: 0 },
    radius: 0,
    spread: 0,
    visible: true,
    ...props
  }
}

/** The SVG of one 100×100 layer with `effects`, and the warnings its export reported. */
function exported(
  effects: Effect[],
  props: Partial<SceneNode> = {},
  type: SceneNode['type'] = 'RECTANGLE'
): { svg: string; warnings: ExportEffectWarning[] } {
  const warnings: ExportEffectWarning[] = []
  const svg = svgOf(
    (graph: SceneGraph, pageId: string) => [
      graph.createNode(type, pageId, {
        name: 'Card',
        width: 100,
        height: 100,
        cornerRadius: 12,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 0.3, visible: true }],
        effects,
        ...props
      }).id
    ],
    { onWarning: (warning) => warnings.push(warning) }
  )
  return { svg, warnings }
}

/** The opening tags of `tag` elements in `svg`. */
function elements(svg: string, tag: string): string[] {
  return Array.from(svg.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g')), ([element]) => element)
}

describe('SVG export effects, as Figma exports them', () => {
  test('a background blur is a clipped backdrop-filter box under the layer', () => {
    const { svg, warnings } = exported([effect('BACKGROUND_BLUR', { radius: 10 })])

    expect(elements(svg, 'foreignObject')).toEqual([
      '<foreignObject x="-10" y="-10" width="120" height="120">'
    ])
    const [div] = elements(svg, 'div')
    // An HTML page inlining the SVG would read `<div/>` as an element it never closes.
    expect(svg).toMatch(/<div [^>]*><\/div>/)
    expect(div).toContain('xmlns="http://www.w3.org/1999/xhtml"')
    expect(div).toContain('backdrop-filter:blur(5px)')
    const clipId = div.match(/clip-path:url\(#([^)]+)\)/)?.[1]
    expect(elements(svg, 'clipPath')).toContain(
      `<clipPath id="${clipId}" transform="translate(10 10)">`
    )
    expect(svg).not.toContain('feGaussianBlur')
    expect(svg.indexOf('<foreignObject')).toBeLessThan(svg.indexOf('fill-opacity="0.3"'))
    expect(warnings).toEqual([])
  })

  test('a background blur stays outside the filter of the layer’s shadows', () => {
    const { svg } = exported([
      effect('BACKGROUND_BLUR', { radius: 10 }),
      effect('DROP_SHADOW', { radius: 8, offset: { x: 4, y: 4 } })
    ])

    const group = svg.slice(svg.indexOf('</foreignObject>'))
    expect(group).toMatch(/^<\/foreignObject>\s*<g filter="url\(#fx\d+\)">/)
  })

  test('a progressive blur is an even blur of its end radius', () => {
    const progressive = {
      startRadius: 0,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 }
    }
    const layer = exported([effect('LAYER_BLUR', { radius: 20, progressive })]).svg
    expect(elements(layer, 'feGaussianBlur')).toEqual([
      expect.stringContaining('stdDeviation="10"')
    ])
    const backdrop = exported([effect('BACKGROUND_BLUR', { radius: 20, progressive })]).svg
    expect(elements(backdrop, 'div')[0]).toContain('backdrop-filter:blur(10px)')
  })

  test('a progressive blur starting wider blurs by its end radius in a box holding its start', () => {
    const progressive = {
      startRadius: 20,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 }
    }
    const layer = exported([effect('LAYER_BLUR', { radius: 4, progressive })]).svg
    expect(elements(layer, 'feGaussianBlur')).toEqual([expect.stringContaining('stdDeviation="2"')])
    expect(elements(layer, 'filter')[0]).toContain('x="-20" y="-20" width="140" height="140"')

    const backdrop = exported([effect('BACKGROUND_BLUR', { radius: 4, progressive })]).svg
    expect(elements(backdrop, 'foreignObject')).toEqual([
      '<foreignObject x="-20" y="-20" width="140" height="140">'
    ])
    expect(elements(backdrop, 'div')[0]).toContain('backdrop-filter:blur(2px)')

    const none = exported([effect('BACKGROUND_BLUR', { radius: 0, progressive })]).svg
    expect(none).not.toContain('<foreignObject')
  })

  test('a translucent layer keeps its blur box out of its opacity group, at its opacity', () => {
    const { svg } = exported([effect('BACKGROUND_BLUR', { radius: 10 })], { opacity: 0.5 })

    // Around the box, the opacity would cut it off from what lies behind the layer.
    expect(svg).toMatch(/<g>\s*<foreignObject/)
    expect(elements(svg, 'div')[0]).toContain('opacity:0.5;')
    expect(svg).toMatch(/<\/foreignObject>\s*<g opacity="0.5">/)
  })

  test('a background blur is clipped to the geometry the layer fills', () => {
    const { svg } = exported(
      [effect('BACKGROUND_BLUR', { radius: 10 })],
      {
        fillGeometry: [
          {
            windingRule: 'EVENODD',
            commandsBlob: polygonBlob([
              { x: 50, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 }
            ])
          }
        ]
      },
      'VECTOR'
    )

    const clip = svg.slice(svg.indexOf('<clipPath'), svg.indexOf('</clipPath>'))
    expect(clip).toContain('d="M50 0L100 100L0 100Z"')
    expect(clip).toContain('clip-rule="evenodd"')
  })

  test('a drop shadow grows by its spread inside a region holding all of it', () => {
    const { svg } = exported([
      effect('DROP_SHADOW', { radius: 8, spread: 6, offset: { x: 4, y: 4 } })
    ])

    expect(elements(svg, 'filter')[0]).toContain(
      'x="-10" y="-10" width="128" height="128" filterUnits="userSpaceOnUse"'
    )
    expect(elements(svg, 'feMorphology')).toEqual([
      expect.stringMatching(/operator="dilate" radius="6"/)
    ])
    expect(elements(svg, 'feGaussianBlur')[0]).toContain('stdDeviation="4"')
  })

  test('an inner shadow shrinks by its spread', () => {
    const { svg } = exported([
      effect('INNER_SHADOW', { radius: 8, spread: 6, offset: { x: 4, y: 4 } })
    ])

    expect(elements(svg, 'feMorphology')).toEqual([
      expect.stringMatching(/operator="erode" radius="6"/)
    ])
    expect(elements(svg, 'feComposite')).toContainEqual(
      expect.stringContaining('operator="arithmetic" k2="-1" k3="1"')
    )
  })

  test('a star’s shadow takes no spread, as in Figma', () => {
    const { svg } = exported([effect('DROP_SHADOW', { radius: 8, spread: 6 })], {}, 'STAR')
    expect(svg).not.toContain('feMorphology')
  })

  test('a shadow hidden behind the layer is cut out of it', () => {
    const shown = exported([effect('DROP_SHADOW', { radius: 8 })]).svg
    const hidden = exported([effect('DROP_SHADOW', { radius: 8, showShadowBehindNode: false })]).svg

    expect(shown).not.toContain('operator="out"')
    expect(elements(hidden, 'feComposite')).toContainEqual(
      expect.stringContaining('operator="out"')
    )
  })

  test('a shadow keeps its blend mode', () => {
    const { svg } = exported([effect('DROP_SHADOW', { radius: 8, blendMode: 'MULTIPLY' })])
    expect(elements(svg, 'feBlend')).toContainEqual(expect.stringContaining('mode="multiply"'))
  })

  test('glass is left out with a warning', () => {
    const { svg, warnings } = exported([effect('GLASS', { radius: 4 })])

    expect(svg).not.toContain('<filter')
    expect(svg).not.toContain('<foreignObject')
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'unsupported-effect', effect: 'GLASS', nodeName: 'Card' })
    ])
  })

  test('an effect the scene graph does not model is left out with a warning, not blurred', () => {
    // A `.fig` file's noise reaches `effects` under a type `Effect` does not list.
    const noiseType: string = 'NOISE'
    const { svg, warnings } = exported([
      effect(noiseType as Effect['type'], { radius: 4 }),
      effect('DROP_SHADOW', { radius: 8 })
    ])

    expect(svg).toContain('<feOffset')
    expect(svg).not.toContain('feGaussianBlur stdDeviation="2"')
    expect(warnings).toEqual([expect.objectContaining({ effect: 'NOISE' })])
  })

  test('a hidden effect is neither drawn nor reported', () => {
    const { svg, warnings } = exported([effect('GLASS', { visible: false })])
    expect(svg).not.toContain('<filter')
    expect(warnings).toEqual([])
  })

  test('the SVG format adapter returns the warnings and passes each to the callback', async () => {
    const graph = new Graph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Lens',
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 0.3, visible: true }],
      effects: [effect('GLASS', { radius: 4 })]
    })
    const callbackWarnings: ExportEffectWarning[] = []

    const result = await io.exportContent(
      'svg',
      { graph, target: { scope: 'node', nodeId: node.id } },
      { onWarning: (warning: ExportEffectWarning) => callbackWarnings.push(warning) }
    )

    expect(result.warnings).toEqual([
      expect.objectContaining({ effect: 'GLASS', nodeId: node.id, nodeName: 'Lens' })
    ])
    expect(callbackWarnings).toEqual(result.warnings ?? [])
  })
})
