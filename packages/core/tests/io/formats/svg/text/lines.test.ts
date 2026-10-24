import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { renderNodesToSVG, type SVGTextLine } from '#core/io/formats/svg'

function exportText(props: Partial<SceneNode>, lines?: SVGTextLine[] | null): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    width: 200,
    height: 60,
    fontSize: 20,
    ...props
  })
  const svg = renderNodesToSVG(graph, pageId, [node.id], {
    xmlDeclaration: false,
    textLayout: lines === undefined ? undefined : () => lines
  })
  if (!svg) throw new Error('nothing exported')
  return svg
}

describe('SVG text with laid-out lines', () => {
  test('without a layout, or with none for the node, the text stays on one line', () => {
    for (const lines of [undefined, null, []]) {
      const svg = exportText({ text: 'First line\nSecond line' }, lines)
      expect(svg).not.toContain('<tspan')
      expect(svg).toContain('y="20"')
    }
  })

  test('each line is placed at its own baseline and the newline is not drawn', () => {
    const text = 'First line\nSecond line'
    const svg = exportText({ text }, [
      { start: 0, end: 11, x: 0, y: 18, width: 80 },
      { start: 11, end: text.length, x: 0, y: 42, width: 96 }
    ])
    expect(svg).toContain('<tspan x="0" y="18">First line</tspan>')
    expect(svg).toContain('<tspan x="0" y="42">Second line</tspan>')
  })

  test('style runs are cut at line breaks and keep their own attributes', () => {
    const svg = exportText(
      {
        text: 'abcdef ghij',
        styleRuns: [{ start: 0, length: 3, style: { fontWeight: 700 } }]
      },
      [
        { start: 0, end: 7, x: 0, y: 18, width: 70 },
        { start: 7, end: 11, x: 0, y: 42, width: 40 }
      ]
    )
    expect(svg).toContain('<tspan x="0" y="18" font-weight="700">abc</tspan>')
    expect(svg).toContain('<tspan>def </tspan>')
    expect(svg).toContain('<tspan x="0" y="42">ghij</tspan>')
  })

  test('lines take their x from the layout instead of the alignment anchor', () => {
    const svg = exportText({ text: 'Centered', textAlignHorizontal: 'CENTER' }, [
      { start: 0, end: 8, x: 61.5, y: 18, width: 77 }
    ])
    expect(svg).not.toContain('text-anchor')
    expect(svg).toContain('<tspan x="61.5" y="18">Centered</tspan>')
  })

  test('a right-to-left line starts at its left edge, with no direction or anchor', () => {
    const svg = exportText({ text: 'مرحبا', textDirection: 'RTL' }, [
      { start: 0, end: 5, x: 120, y: 18, width: 50 }
    ])
    expect(svg).not.toContain('text-anchor')
    expect(svg).not.toContain('direction')
    expect(svg).toContain('<tspan x="120" y="18">مرحبا</tspan>')
  })

  test('with character edges every span is placed where its characters are drawn', () => {
    const edges = (from: number, widths: number[]) =>
      new Map(
        widths.map((width, index) => [
          from + index,
          { left: index * 10, right: index * 10 + width }
        ])
      )
    const svg = exportText(
      {
        text: 'Bold',
        styleRuns: [{ start: 1, length: 3, style: { fontWeight: 700 } }]
      },
      [{ start: 0, end: 4, x: 0, y: 18, width: 40, characters: edges(0, [10, 10, 10, 10]) }]
    )
    expect(svg).toContain('xml:space="preserve"')
    expect(svg).toContain(
      '<tspan x="0" y="18">B</tspan><tspan x="10" y="18" font-weight="700">old</tspan>'
    )
  })

  test('a right-to-left span starts at the left edge of its characters', () => {
    const svg = exportText(
      {
        text: 'אבג',
        textDirection: 'RTL',
        styleRuns: [{ start: 1, length: 2, style: { fontWeight: 700 } }]
      },
      [
        {
          start: 0,
          end: 3,
          x: 70,
          y: 18,
          width: 30,
          characters: new Map([
            [0, { left: 90, right: 100 }],
            [1, { left: 80, right: 90 }],
            [2, { left: 70, right: 80 }]
          ])
        }
      ]
    )
    expect(svg).toContain(
      '<tspan x="90" y="18">א</tspan><tspan x="70" y="18" font-weight="700">בג</tspan>'
    )
  })

  test('laid-out lines hold the text in the case it is shown in', () => {
    const svg = exportText(
      {
        text: 'quiet loud',
        textCase: 'TITLE',
        styleRuns: [{ start: 6, length: 4, style: { textCase: 'UPPER' } }]
      },
      [
        { start: 0, end: 6, x: 0, y: 18, width: 50 },
        { start: 6, end: 10, x: 0, y: 42, width: 50 }
      ]
    )
    expect(svg).toContain('>Quiet </tspan>')
    expect(svg).toContain('>LOUD</tspan>')
  })
})

describe('SVG text case', () => {
  test('keeps text before and after a style run on one line', () => {
    const svg = exportText({
      text: 'Hello bold world',
      styleRuns: [{ start: 6, length: 4, style: { fontWeight: 700 } }]
    })

    expect(svg).toContain('xml:space="preserve"')
    expect(svg).toContain('<tspan>Hello </tspan><tspan font-weight="700">bold</tspan><tspan> world</tspan>')
  })

  test('text on one line is written in the case it is shown in', () => {
    expect(exportText({ text: 'Mixed Case', textCase: 'UPPER' })).toContain('>MIXED CASE</text>')
    const runs = exportText({
      text: 'Mixed Case',
      textCase: 'UPPER',
      styleRuns: [
        { start: 0, length: 6, style: {} },
        { start: 6, length: 4, style: { textCase: 'LOWER' } }
      ]
    })
    expect(runs).toContain('>MIXED </tspan>')
    expect(runs).toContain('>case</tspan>')
  })
})
