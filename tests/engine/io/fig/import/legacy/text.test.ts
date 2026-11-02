import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { lineHeightPixels } from '@open-pencil/scene-graph/text'

import { canvas, doc, node } from './helpers'

/** The name of the style a layer's style ID names, found by the style's own ID as the panel does. */
function styleNamed(graph: SceneGraph, id: string | null | undefined) {
  return [...graph.getAllNodes()].find((style) => style.sharedStyleType && style.source.id === id)
    ?.name
}

describe('fig-import: text properties', () => {
  test('text auto resize', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Hello' },
        fontSize: 16,
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'WIDTH_AND_HEIGHT'
      } as Partial<NodeChange>)
    ]).graph
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(n.textAlignHorizontal).toBe('CENTER')
  })

  test('imports derived glyph geometry for Figma text rendering', () => {
    const glyphBlob = new Uint8Array([0])
    const graph = materializeDocument(
      [
        doc(),
        canvas(),
        node('TEXT', 10, 1, {
          textData: { characters: 'A' },
          fontSize: 14,
          derivedTextData: {
            layoutSize: { x: 10, y: 10 },
            glyphs: [
              {
                commandsBlob: 0,
                position: { x: 2, y: 8 },
                fontSize: 14,
                firstCharacter: 0,
                advance: 1,
                rotation: 0
              }
            ]
          }
        } as Partial<NodeChange>)
      ],
      [glyphBlob]
    ).graph
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.derivedTextGlyphs).toEqual([
      {
        commandsBlob: glyphBlob,
        firstCharacter: 0,
        x: 2,
        y: 8,
        fontSize: 14,
        // Path text needs per-glyph rotation preserved through import (#396);
        // plain text imports it as 0 rather than dropping the field.
        rotation: 0,
        // One em at 14px, so decorations can stop where the glyph ends.
        advance: 14
      }
    ])

    graph.updateNode(n.id, { opacity: 0.5 })
    expect(graph.getNode(n.id)?.derivedTextGlyphs).toHaveLength(1)

    graph.updateNode(n.id, { text: 'B' })
    expect(graph.getNode(n.id)?.derivedTextGlyphs).toBeNull()
  })

  test('uses derived line metrics for imported Figma text rendering', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Default' },
        fontSize: 14,
        lineHeight: { value: 36, units: 'PIXELS' },
        derivedTextData: {
          layoutSize: { x: 49, y: 14 },
          baselines: [
            {
              firstCharacter: 0,
              endCharacter: 7,
              position: { x: 0, y: 12.09 },
              width: 48.25,
              lineY: 0,
              lineHeight: 16.94,
              lineAscent: 13
            }
          ]
        }
      } as Partial<NodeChange>)
    ]).graph
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(lineHeightPixels(n.lineHeight, n.fontSize)).toBe(16.94)
  })

  test('keeps a pixel line height shorter than the font, which Figma saves lines taller than', () => {
    // Figma saves each line at the larger of its line height and its font's height.
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Tight\nlines' },
        fontSize: 24,
        lineHeight: { value: 10, units: 'PIXELS' },
        derivedTextData: {
          baselines: [
            {
              firstCharacter: 0,
              endCharacter: 6,
              position: { x: 0, y: 13.73 },
              width: 60,
              lineY: 0,
              lineHeight: 29.05,
              lineAscent: 23
            }
          ]
        }
      } as Partial<NodeChange>)
    ]).graph
    const [text] = graph.getChildren(graph.getPages()[0].id)
    expect(text && lineHeightPixels(text.lineHeight, text.fontSize)).toBe(10)
  })

  test('reads line heights as Figma writes them: auto as 100 percent, a percent as a multiplier', () => {
    // A 40px word on the first line: its height must not fix every line of an auto text.
    const derivedTextData = {
      baselines: [
        {
          firstCharacter: 0,
          endCharacter: 6,
          position: { x: 0, y: 38.5 },
          width: 100,
          lineY: 0,
          lineHeight: 48.4,
          lineAscent: 38
        }
      ]
    }
    const text = (lineHeight: NodeChange['lineHeight'], guid: number) =>
      node('TEXT', guid, 1, {
        textData: { characters: 'Mixed\nlines' },
        fontSize: 24,
        lineHeight,
        derivedTextData
      } as Partial<NodeChange>)
    const graph = materializeDocument([
      doc(),
      canvas(),
      text({ value: 100, units: 'PERCENT' }, 10),
      text({ value: 1.5, units: 'RAW' }, 11)
    ]).graph
    const [auto, raw] = graph.getChildren(graph.getPages()[0].id)
    expect(auto.lineHeight).toBeNull()
    expect(lineHeightPixels(raw.lineHeight, raw.fontSize)).toBe(36)
  })

  test('applies shared text style refs', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('TEXT', 20, 1, {
        name: 'Body style',
        styleType: 'TEXT',
        fontSize: 16,
        fontName: { family: 'Inter', style: 'Regular' },
        lineHeight: { value: 24, units: 'PIXELS' }
      } as Partial<NodeChange>),
      node('TEXT', 10, 1, {
        textData: { characters: 'Styled text' },
        fontSize: 48,
        fontName: { family: 'Inter', style: 'Extra Bold' },
        textDecoration: 'UNDERLINE',
        styleIdForText: { guid: { sessionID: 1, localID: 20 } }
      } as Partial<NodeChange>)
    ]).graph
    const styled = graph
      .getChildren(graph.getPages()[0].id)
      .find((node) => node.text === 'Styled text')
    expect(styled?.fontSize).toBe(16)
    expect(styleNamed(graph, styled?.textStyleId)).toBe('Body style')
    expect(styled?.fontWeight).toBe(400)
    expect(styled && lineHeightPixels(styled.lineHeight, styled.fontSize)).toBe(24)
    expect(styled?.textDecoration).toBe('NONE')
    const style = [...graph.getAllNodes()].find((node) => node.source.id === '1:20')
    expect(style).toMatchObject({ name: 'Body style', sharedStyleType: 'TEXT', internalOnly: true })
  })

  test('points ranges at the styles and layers imported with them', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('TEXT', 20, 1, {
        name: 'Heading style',
        styleType: 'TEXT',
        fontSize: 24,
        fontName: { family: 'Inter', style: 'Regular' }
      } as Partial<NodeChange>),
      node('FRAME', 30, 1, { name: 'Target' } as Partial<NodeChange>),
      node('TEXT', 10, 1, {
        name: 'Linked',
        fontSize: 16,
        textData: {
          characters: 'styled link',
          characterStyleIDs: [1, 1, 1, 1, 1, 1, 0, 2, 2, 2, 2],
          styleOverrideTable: [
            { styleID: 1, styleIdForText: { guid: { sessionID: 1, localID: 20 } } },
            { styleID: 2, hyperlink: { guid: { sessionID: 1, localID: 30 } } }
          ]
        }
      } as Partial<NodeChange>)
    ]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    const text = nodes.find((child) => child.name === 'Linked')
    const target = nodes.find((child) => child.name === 'Target')
    const style = [...graph.getAllNodes()].find((child) => child.name === 'Heading style')
    expect(text?.styleRuns.map((run) => run.style)).toEqual([
      expect.objectContaining({ textStyleId: style?.source.id }),
      { hyperlink: { type: 'NODE', value: target?.id } }
    ])
  })

  test('applies shared fill style refs', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('ROUNDED_RECTANGLE', 30, 1, {
        name: 'slate/900',
        styleType: 'FILL',
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 0.05882352963089943, g: 0.09019608050584793, b: 0.16470588743686676, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      } as Partial<NodeChange>),
      node('ROUNDED_RECTANGLE', 10, 1, {
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 1, b: 1, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        styleIdForFill: { guid: { sessionID: 1, localID: 30 } }
      } as Partial<NodeChange>)
    ]).graph
    const styled = graph
      .getChildren(graph.getPages()[0].id)
      .find((node) => node.name === 'ROUNDED_RECTANGLE_10')
    expect(styleNamed(graph, styled?.fillStyleId)).toBe('slate/900')
    expect(styled?.fills[0]?.color).toEqual({
      r: 0.05882352963089943,
      g: 0.09019608050584793,
      b: 0.16470588743686676,
      a: 1
    })
  })

  test('font weight mapping', () => {
    const cases = [
      ['Bold', 700],
      ['Semi Bold', 600],
      ['Light', 300],
      ['ExtraBold', 800],
      ['Black', 900],
      ['Thin', 100],
      ['Medium', 500],
      ['Regular', 400]
    ] as const

    for (const [style, expected] of cases) {
      const graph = materializeDocument([
        doc(),
        canvas(),
        node('TEXT', 10, 1, {
          textData: { characters: 'X' },
          fontName: { family: 'Inter', style }
        } as Partial<NodeChange>)
      ]).graph
      const n = graph.getChildren(graph.getPages()[0].id)[0]
      expect(n.fontWeight).toBe(expected)
    }
  })
})
