import { describe, expect, test } from 'bun:test'

import type { ExportEffectWarning } from '@open-pencil/core/io/formats/svg'
import { noise, texture } from '@open-pencil/design-jsx'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { SceneGraph as Graph } from '@open-pencil/scene-graph'
import { polygonBlob } from '@open-pencil/test-support/geometry'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { noiseDensityTable } from '#core/io/formats/svg/grain'

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

/** `count` steps of `value` in a noise table. */
function steps(count: number, value: number): number[] {
  return Array.from({ length: count }, () => value)
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
    // Only a document built outside the scene graph's types can hold a repeat.
    const repeatType: string = 'REPEAT'
    const { svg, warnings } = exported([
      effect(repeatType as Effect['type'], { radius: 4 }),
      effect('DROP_SHADOW', { radius: 8 })
    ])

    expect(svg).toContain('<feOffset')
    expect(svg).not.toContain('feGaussianBlur stdDeviation="2"')
    expect(warnings).toEqual([expect.objectContaining({ effect: 'REPEAT' })])
  })

  test('a noise grains the layer in a band of fractal noise that its density widens', () => {
    const { svg, warnings } = exported([
      noise({ color: '#000000', noiseSize: { x: 2, y: 5 }, density: 0.2 })
    ])

    expect(warnings).toEqual([])
    expect(elements(svg, 'feTurbulence')[0]).toContain('baseFrequency="0.5 0.2"')
    // Figma's table for density 0.2, read in 32-bit floats: 19 off, 11 on, 70 off.
    expect(noiseDensityTable(0.2)).toBe(
      [...steps(19, 0), ...steps(11, 1), ...steps(70, 0)].join(' ')
    )
    expect(noiseDensityTable(1)).toBe([...steps(51, 1), ...steps(49, 0)].join(' '))
    expect(noiseDensityTable(0)).toBe([...steps(25, 0), 1, ...steps(74, 0)].join(' '))
  })

  test('a duotone noise adds the opposite band in its second colour; a multitone its own colours', () => {
    const duotone = exported([
      noise({ noiseType: 'DUOTONE', color: '#000000', secondaryColor: '#ff0000' })
    ]).svg
    const colors = elements(duotone, 'feFlood').flatMap(
      (flood) => flood.match(/flood-color="([^"]+)"/)?.[1] ?? []
    )
    expect(colors).toEqual(['#000000', '#FF0000'])
    expect(duotone).toContain(`tableValues="${noiseDensityTable(1, true)}"`)

    const multitone = exported([noise({ noiseType: 'MULTITONE', opacity: 0.4 })]).svg
    expect(elements(multitone, 'feFuncR')).toEqual([
      '<feFuncR type="linear" slope="2" intercept="-0.5"/>'
    ])
    expect(multitone).toContain('tableValues="0 0.4"')
  })

  test('a texture displaces the layer by twice its radius, clipped to its shape when asked', () => {
    const loose = exported([texture({ noiseSize: 2, radius: 4, clipToShape: false })])
    expect(elements(loose.svg, 'feDisplacementMap')).toEqual([expect.stringContaining('scale="8"')])
    // Unclipped, the edges may move out by the radius, so the export grows by it on every side.
    expect(loose.svg).toContain('width="108" height="108"')
    expect(elements(loose.svg, 'filter')[0]).toContain('x="-4" y="-4" width="108" height="108"')

    const clipped = exported([texture({ noiseSize: 2, radius: 4, clipToShape: true })])
    expect(elements(clipped.svg, 'feDisplacementMap')).toHaveLength(3)
    expect(clipped.svg).toContain('width="100" height="100"')
    expect(loose.warnings.concat(clipped.warnings)).toEqual([])
  })

  test('a flood carries its alpha once, in Display P3 too', () => {
    const half = { r: 1, g: 0, b: 0, a: 0.5 }
    const svg = svgOf(
      (graph: SceneGraph, pageId: string) => [
        graph.createNode('RECTANGLE', pageId, {
          width: 100,
          height: 100,
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
          effects: [
            effect('DROP_SHADOW', { radius: 8, color: half }),
            noise({ color: half, density: 1 })
          ]
        }).id
      ],
      { colorSpace: 'display-p3' }
    )
    const floods = elements(svg, 'feFlood').filter((flood) => flood.includes('flood-color'))
    expect(floods).toHaveLength(2)
    for (const flood of floods) {
      expect(flood).toContain('flood-opacity="0.5"')
      expect(flood).not.toMatch(/flood-color="[^"]*\/\s*0\.5/)
    }
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
