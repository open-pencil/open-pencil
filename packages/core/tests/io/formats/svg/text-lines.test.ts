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

  test('a right-to-left line is anchored at its end', () => {
    const svg = exportText({ text: 'مرحبا', textDirection: 'RTL' }, [
      { start: 0, end: 5, x: 120, y: 18, width: 50 }
    ])
    expect(svg).toContain('text-anchor="end"')
    expect(svg).toContain('<tspan x="170" y="18">مرحبا</tspan>')
  })
})
