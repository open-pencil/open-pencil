import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

describe('Figma font variation export', () => {
  test('exports base and styled-run variable font axes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'Axis',
      fontVariations: [{ axis: 'wght', value: 650 }],
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 1.5,
      leadingTrim: 'CAP_HEIGHT',
      textDecorationFills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ],
      fontFeatures: [
        { tag: 'LIGA', enabled: false },
        { tag: 'DLIG', enabled: true },
        { tag: 'HLIG', enabled: false },
        { tag: 'ORDN', enabled: true },
        { tag: 'ZERO', enabled: true },
        { tag: 'ONUM', enabled: true },
        { tag: 'TNUM', enabled: true },
        { tag: 'FRAC', enabled: true },
        { tag: 'SMCP', enabled: true },
        { tag: 'KERN', enabled: false }
      ],
      styleRuns: [
        {
          start: 0,
          length: 2,
          style: {
            fontVariations: [{ axis: 'wdth', value: 88 }],
            fontFeatures: [
              { tag: 'CALT', enabled: false },
              { tag: 'SS01', enabled: true }
            ],
            textDecoration: 'UNDERLINE',
            textDecorationStyle: 'DOTTED',
            textDecorationThickness: 2
          }
        }
      ]
    })

    const changes = sceneNodeToKiwi(text, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const nodeChange = changes[0]

    expect(nodeChange.fontVariations).toEqual([
      { axisTag: 0x77676874, axisName: 'wght', value: 650 }
    ])
    expect(nodeChange.textDecorationStyle).toBe('WAVY')
    expect(nodeChange.textDecorationThickness).toEqual({ value: 1.5, units: 'PIXELS' })
    expect(nodeChange.leadingTrim).toBe('CAP_HEIGHT')
    expect(nodeChange.textDecorationFillPaints?.[0]?.type).toBe('SOLID')
    expect(nodeChange.fontVariantCommonLigatures).toBe(false)
    expect(nodeChange.fontVariantContextualLigatures).toBe(true)
    expect(nodeChange.fontVariantDiscretionaryLigatures).toBe(true)
    expect(nodeChange.fontVariantHistoricalLigatures).toBe(false)
    expect(nodeChange.fontVariantOrdinal).toBe(true)
    expect(nodeChange.fontVariantSlashedZero).toBe(true)
    expect(nodeChange.fontVariantNumericFigure).toBe('OLDSTYLE')
    expect(nodeChange.fontVariantNumericSpacing).toBe('TABULAR')
    expect(nodeChange.fontVariantNumericFraction).toBe('DIAGONAL')
    expect(nodeChange.fontVariantCaps).toBe('SMALL')
    expect(nodeChange.toggledOffOTFeatures).toEqual(['KERN'])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.fontVariations).toEqual([
      { axisTag: 0x77647468, axisName: 'wdth', value: 88 }
    ])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.fontVariantContextualLigatures).toBe(false)
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.toggledOnOTFeatures).toEqual(['SS01'])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.textDecorationStyle).toBe('DOTTED')
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.textDecorationThickness).toEqual({
      value: 2,
      units: 'PIXELS'
    })
  })

  test('exports all-caps OpenType variant fields', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const allSmall = graph.createNode('TEXT', page.id, {
      text: 'Small',
      fontFeatures: [
        { tag: 'SMCP', enabled: true },
        { tag: 'C2SC', enabled: true }
      ]
    })
    const allPetite = graph.createNode('TEXT', page.id, {
      text: 'Petite',
      fontFeatures: [
        { tag: 'PCAP', enabled: true },
        { tag: 'C2PC', enabled: true }
      ]
    })

    const smallChange = sceneNodeToKiwi(
      allSmall,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )[0]
    const petiteChange = sceneNodeToKiwi(
      allPetite,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )[0]

    expect(smallChange.fontVariantCaps).toBe('ALL_SMALL')
    expect(petiteChange.fontVariantCaps).toBe('ALL_PETITE')
  })
})
