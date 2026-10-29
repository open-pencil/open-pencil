import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

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

function textElement(svg: string): string {
  const text = svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/)?.[0]
  if (!text) throw new Error('no text element')
  return text
}

describe('SVG text with laid-out lines', () => {
  test('without a measured layout, each explicit newline keeps its own baseline', () => {
    for (const lines of [undefined, null, []]) {
      const svg = exportText(
        { text: 'First line\nSecond line', fontSize: 16, lineHeight: pixelLength(24), width: 100 },
        lines
      )
      const text = textElement(svg)
      expect(text).toContain('<tspan x="0" y="16">First line</tspan>')
      expect(text).toContain('<tspan x="0" y="40">Second line</tspan>')
      expect(text).not.toContain('\n')
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

describe('SVG text lines without a measured layout', () => {
  test('a single line stays one text element', () => {
    const svg = exportText({
      text: 'First line',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100
    })
    expect(textElement(svg)).toBe(
      '<text x="0" y="16" font-family="Inter" font-size="16" fill="#000000">First line</text>'
    )
  })

  test('an automatic line height spaces baselines by 1.2 times the font size', () => {
    const svg = exportText({
      text: 'First line\nSecond line',
      fontSize: 16,
      lineHeight: null,
      width: 100
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">First line</tspan>')
    expect(text).toContain('<tspan x="0" y="35.2">Second line</tspan>')
  })

  test('an automatic line height steps by the font size of the line it reaches', () => {
    const below = exportText({
      text: 'Aa\nBc',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      // Only "B" is larger, so the line takes the tallest font on it: 40 * 1.2.
      styleRuns: [{ start: 3, length: 1, style: { fontSize: 40 } }]
    })
    const belowText = textElement(below)
    expect(belowText).toContain('<tspan x="0" y="16">Aa</tspan>')
    expect(belowText).toContain('<tspan x="0" y="64" font-size="40">B</tspan>')
    expect(belowText).toContain('<tspan>c</tspan>')

    const above = exportText({
      text: 'Aa\nBb',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      styleRuns: [{ start: 0, length: 2, style: { fontSize: 40 } }]
    })
    const aboveText = textElement(above)
    expect(aboveText).toContain('<tspan x="0" y="16" font-size="40">Aa</tspan>')
    expect(aboveText).toContain('<tspan x="0" y="35.2">Bb</tspan>')
  })

  test('an explicit line height does not follow a run font size', () => {
    const svg = exportText({
      text: 'Aa\nBb',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100,
      styleRuns: [{ start: 3, length: 2, style: { fontSize: 40 } }]
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">Aa</tspan>')
    expect(text).toContain('<tspan x="0" y="40" font-size="40">Bb</tspan>')
  })

  test("a run's line height sets the step of the line it is on", () => {
    const svg = exportText({
      text: 'one\ntwo\nthree',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      styleRuns: [{ start: 4, length: 3, style: { lineHeight: pixelLength(50) } }]
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">one</tspan>')
    expect(text).toContain('<tspan x="0" y="66">two</tspan>')
    expect(text).toContain('<tspan x="0" y="85.2">three</tspan>')
  })

  test('a blank line is as tall as the newline that makes it', () => {
    const svg = exportText({
      text: 'A\n\nC',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      styleRuns: [{ start: 2, length: 1, style: { fontSize: 40 } }]
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">A</tspan>')
    expect(text).toContain('<tspan x="0" y="83.2">C</tspan>')
  })

  test('a newline styled apart from its line does not set that line', () => {
    const svg = exportText({
      text: 'A\nB\nC',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      // The break before C, and C itself. The break must not size "B".
      styleRuns: [{ start: 3, length: 2, style: { fontSize: 40 } }]
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">A</tspan>')
    expect(text).toContain('<tspan x="0" y="35.2">B</tspan>')
    expect(text).toContain('<tspan x="0" y="83.2" font-size="40">C</tspan>')

    const crlf = exportText({
      text: 'A\nB\r\nC',
      fontSize: 16,
      lineHeight: null,
      width: 100,
      styleRuns: [{ start: 3, length: 2, style: { fontSize: 40 } }]
    })
    const crlfText = textElement(crlf)
    expect(crlfText).toContain('<tspan x="0" y="16">A</tspan>')
    expect(crlfText).toContain('<tspan x="0" y="35.2">B</tspan>')
    expect(crlfText).toContain('<tspan x="0" y="54.4">C</tspan>')
  })

  test('a line shorter than the node steps by its own font size', () => {
    const svg = exportText({
      text: 'A\nBb\nC',
      fontSize: 40,
      lineHeight: null,
      width: 100,
      styleRuns: [{ start: 2, length: 2, style: { fontSize: 10 } }]
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="40">A</tspan>')
    expect(text).toContain('<tspan x="0" y="52" font-size="10">Bb</tspan>')
    expect(text).toContain('<tspan x="0" y="100">C</tspan>')
  })

  test('a percent line height spaces by the pixel length stored on the node', () => {
    const svg = exportText({
      text: 'First line\nSecond line',
      fontSize: 10,
      // 120% of 10px is stored on the node as 12px.
      lineHeight: pixelLength(12),
      width: 100
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="10">First line</tspan>')
    expect(text).toContain('<tspan x="0" y="22">Second line</tspan>')
  })

  test('centered and right-aligned lines share the single-line anchor', () => {
    const center = exportText({
      text: 'First line\nSecond line',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100,
      textAlignHorizontal: 'CENTER'
    })
    expect(center).toContain('text-anchor="middle"')
    expect(center).toContain('<tspan x="50" y="16">First line</tspan>')
    expect(center).toContain('<tspan x="50" y="40">Second line</tspan>')

    const right = exportText({
      text: 'First line\nSecond line',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100,
      textAlignHorizontal: 'RIGHT'
    })
    expect(right).toContain('text-anchor="end"')
    expect(right).toContain('<tspan x="100" y="16">First line</tspan>')
    expect(right).toContain('<tspan x="100" y="40">Second line</tspan>')
  })

  test('a right-to-left paragraph keeps the logical anchor on every line', () => {
    const svg = exportText({
      text: 'أول\nثان',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 180,
      textDirection: 'RTL',
      textAlignHorizontal: 'LEFT'
    })
    expect(svg).toContain('direction="rtl"')
    expect(svg).toContain('text-anchor="end"')
    expect(svg).toContain('<tspan x="180" y="16">أول</tspan>')
    expect(svg).toContain('<tspan x="180" y="40">ثان</tspan>')
  })

  test('style runs are cut at newlines and a blank line still advances the baseline', () => {
    const styled = exportText({
      text: 'abcd\nefgh',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100,
      styleRuns: [{ start: 2, length: 4, style: { fontWeight: 700 } }]
    })
    expect(textElement(styled)).toContain(
      '<tspan x="0" y="16">ab</tspan><tspan font-weight="700">cd</tspan><tspan x="0" y="40" font-weight="700">e</tspan><tspan>fgh</tspan>'
    )

    const blank = exportText({
      text: 'A\n\nC',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100
    })
    const text = textElement(blank)
    expect(text).toContain('<tspan x="0" y="16">A</tspan>')
    expect(text).toContain('<tspan x="0" y="64">C</tspan>')
    expect(text).not.toContain('\n')
  })

  test('a carriage return is dropped only when it belongs to a CRLF', () => {
    const crlf = textElement(
      exportText({ text: 'A\r\nB', fontSize: 16, lineHeight: pixelLength(24), width: 100 })
    )
    expect(crlf).toContain('<tspan x="0" y="16">A</tspan>')
    expect(crlf).toContain('<tspan x="0" y="40">B</tspan>')
    expect(crlf).not.toContain('\r')

    const trailing = textElement(
      exportText({ text: 'A\nB\r', fontSize: 16, lineHeight: pixelLength(24), width: 100 })
    )
    expect(trailing).toContain('<tspan x="0" y="16">A</tspan>')
    expect(trailing).toContain('>B\r</tspan>')

    const middle = textElement(
      exportText({ text: 'A\rB\nC', fontSize: 16, lineHeight: pixelLength(24), width: 100 })
    )
    expect(middle).toContain('>A\rB</tspan>')
    expect(middle).toContain('<tspan x="0" y="40">C</tspan>')
  })

  test('spaces at the ends of a line are kept', () => {
    const svg = exportText({
      text: '  First\nSecond  ',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100
    })
    const text = textElement(svg)
    expect(text).toContain('xml:space="preserve"')
    expect(text).toContain('>  First</tspan>')
    expect(text).toContain('>Second  </tspan>')
  })
})

describe('SVG text case', () => {
  test('keeps text before and after a style run on one line', () => {
    const svg = exportText({
      text: 'Hello bold world',
      styleRuns: [{ start: 6, length: 4, style: { fontWeight: 700 } }]
    })

    expect(svg).toContain('xml:space="preserve"')
    expect(svg).toContain(
      '<tspan>Hello </tspan><tspan font-weight="700">bold</tspan><tspan> world</tspan>'
    )
  })

  test('each explicit line is written in the case it is shown in', () => {
    const svg = exportText({
      text: 'straße\nnext',
      textCase: 'UPPER',
      fontSize: 16,
      lineHeight: pixelLength(24),
      width: 100
    })
    const text = textElement(svg)
    expect(text).toContain('<tspan x="0" y="16">STRASSE</tspan>')
    expect(text).toContain('<tspan x="0" y="40">NEXT</tspan>')
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

// A run that changes the size spaces its characters at its own size, as the canvas does.
test('a larger run resolves the percent spacing it inherits at its own size', () => {
  const svg = exportText({
    text: 'ab',
    fontSize: 20,
    letterSpacing: percentLength(10),
    styleRuns: [{ start: 1, length: 1, style: { fontSize: 40 } }]
  })
  expect(svg).toContain('letter-spacing="2"')
  expect(svg).toContain('<tspan font-size="40" letter-spacing="4">b</tspan>')
})

test("a run's own zero spacing is written, so it does not inherit the layer's", () => {
  const svg = exportText({
    text: 'ab',
    fontSize: 20,
    letterSpacing: pixelLength(2),
    styleRuns: [{ start: 1, length: 1, style: { letterSpacing: percentLength(0) } }]
  })
  expect(svg).toContain('<tspan letter-spacing="0">b</tspan>')
})
