import { describe, expect, test } from 'bun:test'

import { designJSXElement, sceneNodeToJSX } from '#design-jsx/index'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

function exportText(fields: Partial<SceneNode>): string {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    name: 'Note',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...fields
  })
  return sceneNodeToJSX(node.id, graph)
}

describe('rich text export', () => {
  test('writes a range case and a URL link as Span props', () => {
    const code = exportText({
      text: 'Read docs',
      styleRuns: [
        {
          start: 5,
          length: 4,
          style: { textCase: 'UPPER', hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
        },
        { start: 0, length: 4, style: { hyperlink: { type: 'NODE', value: '1:2' } } }
      ]
    })
    expect(code).toContain('Read <Span textCase="upper" href="https://openpencil.dev">docs</Span>')
  })

  test('writes styled characters as spans with only what differs', () => {
    const code = exportText({
      text: 'Hello world!',
      fontWeight: 700,
      styleRuns: [
        { start: 6, length: 5, style: { fontWeight: 700, fills: [colorToFill('#EE2222')] } }
      ]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" weight="bold">Hello <Span color="#EE2222">world</Span>!</Text>'
    )
  })

  test('writes every character style under its Text prop name', () => {
    const code = exportText({
      text: 'ab',
      styleRuns: [
        {
          start: 0,
          length: 1,
          style: {
            fontSize: 20,
            fontFamily: 'Roboto',
            fontWeight: 500,
            italic: true,
            lineHeight: pixelLength(30),
            letterSpacing: pixelLength(1),
            textDecoration: 'STRIKETHROUGH'
          }
        },
        { start: 1, length: 1, style: { italic: false } }
      ]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000"><Span size={20} font="Roboto" weight="medium" italic lineHeight={30} letterSpacing={1} textDecoration="strikethrough">a</Span>b</Text>'
    )
  })

  test('writes paragraphs when one is a list item or spaced', () => {
    const code = exportText({
      text: 'Intro\nFirst\nNested',
      textParagraphs: [
        { listType: 'NONE', indentation: 0, paragraphSpacing: 12 },
        { listType: 'ORDERED', indentation: 1 },
        { listType: 'ORDERED', indentation: 2, listSpacing: 4, paragraphIndent: 8 }
      ],
      styleRuns: [{ start: 6, length: 5, style: { fontWeight: 700 } }]
    })
    expect(code).toBe(`<Text name="Note" color="#000000">
  <Paragraph spacing={12}>Intro</Paragraph>
  <Paragraph list="ordered"><Span weight="bold">First</Span></Paragraph>
  <Paragraph list="ordered" level={2} listSpacing={4} indent={8}>Nested</Paragraph>
</Text>`)
  })

  test('writes decoration details on the text and on spans', () => {
    const code = exportText({
      text: 'ab',
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'DOTTED',
      textDecorationFills: [colorToFill('#EE2222')],
      textDecorationThickness: 2,
      textDecorationSkipInk: false,
      styleRuns: [
        {
          start: 1,
          length: 1,
          style: {
            textDecorationStyle: 'WAVY',
            textDecorationFills: [],
            textDecorationThickness: null,
            textUnderlineOffset: 3,
            textDecorationSkipInk: true
          }
        }
      ]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" textDecoration="underline" textDecorationStyle="dotted" textDecorationColor="#EE2222" textDecorationThickness={2} textDecorationSkipInk={false}>a<Span textDecorationStyle="wavy" textDecorationColor="currentColor" textDecorationThickness="auto" textUnderlineOffset={3} textDecorationSkipInk>b</Span></Text>'
    )
  })

  test('writes font settings on the text and on spans', () => {
    const code = exportText({
      text: 'ab',
      fontFeatures: [{ tag: 'LIGA', enabled: false }],
      fontVariations: [{ axis: 'wght', value: 450 }],
      textLanguage: 'en',
      styleRuns: [
        {
          start: 1,
          length: 1,
          style: {
            fontFeatures: [{ tag: 'TNUM', enabled: true }],
            fontVariations: [{ axis: 'wght', value: 650 }],
            textLanguage: 'de'
          }
        }
      ]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" fontFeatures={{ liga: false }} fontVariations={{ wght: 450 }} lang="en">a<Span fontFeatures={{ tnum: true }} fontVariations={{ wght: 650 }} lang="de">b</Span></Text>'
    )
  })

  test('writes an optical size that does not follow the font size', () => {
    const code = exportText({
      text: 'a',
      fontVariations: [{ axis: 'opsz', value: 14 }],
      opticalSizeFromFontSize: false
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" fontVariations={{ opsz: 14 }} fontOpticalSizing="none">a</Text>'
    )
  })

  test('writes a percent of the font size as a percent string', () => {
    const code = exportText({
      text: 'ab',
      lineHeight: percentLength(150),
      letterSpacing: percentLength(5),
      styleRuns: [{ start: 1, length: 1, style: { letterSpacing: percentLength(-2) } }]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" lineHeight="150%" letterSpacing="5%">a<Span letterSpacing="-2%">b</Span></Text>'
    )
  })

  test('writes auto line height and no fills in a span', () => {
    const code = exportText({
      text: 'ab',
      lineHeight: pixelLength(20),
      styleRuns: [{ start: 1, length: 1, style: { lineHeight: null, fills: [] } }]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000" lineHeight={20}>a<Span fills={[]} lineHeight="auto">b</Span></Text>'
    )
  })

  test('writes the text-wide spacing, and a paragraph only where it differs', () => {
    const code = exportText({
      text: 'a\nb',
      paragraphSpacing: 8,
      listSpacing: 2,
      paragraphIndent: 4,
      hangingList: true,
      textParagraphs: [
        { listType: 'NONE', indentation: 0, paragraphSpacing: 8, paragraphIndent: 6 },
        { listType: 'NONE', indentation: 0, paragraphSpacing: 8 }
      ]
    })
    expect(code)
      .toBe(`<Text name="Note" color="#000000" paragraphSpacing={8} listSpacing={2} paragraphIndent={4} hangingList>
  <Paragraph indent={6}>a</Paragraph>
  <Paragraph>b</Paragraph>
</Text>`)
  })

  test('keeps spaces and syntax characters next to spans', () => {
    const code = exportText({
      text: ' a {b} ',
      styleRuns: [{ start: 1, length: 1, style: { fontWeight: 700 } }]
    })
    expect(code).toBe(
      '<Text name="Note" color="#000000"> <Span weight="bold">a</Span>{" {b} "}</Text>'
    )
  })

  test('writes plain text as before', () => {
    const code = exportText({
      text: 'One\nTwo',
      textParagraphs: [{ listType: 'NONE', indentation: 0 }],
      styleRuns: [{ start: 0, length: 3, style: { fontWeight: 400 } }]
    })
    expect(code).toBe('<Text name="Note" color="#000000">{"One\\nTwo"}</Text>')
  })
})

describe('designJSXElement', () => {
  function describeText(fields: Partial<SceneNode>) {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, { name: 'Note', ...fields })
    return { element: designJSXElement(node.id, graph), code: sceneNodeToJSX(node.id, graph) }
  }

  /** What the exported element holds between its opening and closing tags. */
  function between(code: string): string {
    return code.slice(code.indexOf('>') + 1, code.lastIndexOf('</Text>'))
  }

  test('describes plain text as before', () => {
    expect(describeText({ text: 'One\nTwo' }).element?.text).toBe('{"One\\nTwo"}')
    expect(describeText({ text: '' }).element?.text).toBeNull()
  })

  test('describes spans and paragraphs as the export writes them', () => {
    const spans = describeText({
      text: 'Hello world',
      styleRuns: [{ start: 6, length: 5, style: { fontWeight: 700 } }]
    })
    expect(spans.element?.text).toBe('Hello <Span weight="bold">world</Span>')
    expect(spans.element?.text).toBe(between(spans.code))

    const paragraphs = describeText({
      text: 'a\nb',
      textParagraphs: [
        { listType: 'UNORDERED', indentation: 1 },
        { listType: 'UNORDERED', indentation: 1 }
      ]
    })
    expect(paragraphs.element?.text).toBe(
      '\n  <Paragraph list="unordered">a</Paragraph>\n  <Paragraph list="unordered">b</Paragraph>\n'
    )
    expect(paragraphs.element?.text).toBe(between(paragraphs.code))
  })
})
