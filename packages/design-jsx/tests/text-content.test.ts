import { describe, expect, test } from 'bun:test'

import { createDesignJSXRenderer } from '#design-jsx/index'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

const renderer = createDesignJSXRenderer<never>({
  icon: () => Promise.resolve(null),
  svg: () => null,
  createArtwork: () => {
    throw new Error('No artwork in these tests')
  },
  layout: () => {
    // Text content does not depend on layout.
  },
  vectorBounds: () => {
    throw new Error('No vectors in these tests')
  }
})

async function renderText(source: string): Promise<{ node: SceneNode; warnings: string[] }> {
  const graph = new SceneGraph()
  const [result] = await renderer.renderJSX(graph, source)
  const node = graph.getNode(result.id)
  if (!node) throw new Error('Rendered text is missing')
  return { node, warnings: result.warnings ?? [] }
}

describe('Span', () => {
  test('cases and links its characters', async () => {
    const { node, warnings } = await renderText(
      '<Text textCase="upper">Read <Span textCase="original" href="https://openpencil.dev">the docs</Span></Text>'
    )
    expect(warnings).toEqual([])
    expect(node.textCase).toBe('UPPER')
    expect(node.styleRuns).toEqual([
      {
        start: 5,
        length: 8,
        style: { textCase: 'ORIGINAL', hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
      }
    ])
  })

  test('rejects an empty link', async () => {
    await expect(renderText('<Text><Span href="">a</Span></Text>')).rejects.toThrow(
      'Invalid <Span> props'
    )
  })

  test('styles its characters with what differs from the text', async () => {
    const { node } = await renderText(
      '<Text size={24} weight="bold">Hello <Span weight="bold" size={24} color="#EE2222">world</Span>!</Text>'
    )
    expect(node.text).toBe('Hello world!')
    expect(node.fontWeight).toBe(700)
    expect(node.styleRuns).toEqual([
      { start: 6, length: 5, style: { fills: [colorToFill('#EE2222')] } }
    ])
  })

  test('takes the text props a character can have, under the same names', async () => {
    const { node, warnings } = await renderText(
      '<Text><Span font="Roboto" fontSize={20} fontWeight={600} italic lineHeight={30} letterSpacing={1} textDecoration="underline">a</Span></Text>'
    )
    expect(node.styleRuns[0]?.style).toEqual({
      fontFamily: 'Roboto',
      fontSize: 20,
      fontWeight: 600,
      italic: true,
      lineHeight: pixelLength(30),
      letterSpacing: pixelLength(1),
      textDecoration: 'UNDERLINE'
    })
    expect(warnings).toEqual([])
  })

  test('takes a line height and letter spacing as a percent of the font size', async () => {
    const { node, warnings } = await renderText(
      '<Text lineHeight="150%" letterSpacing="5%">a<Span letterSpacing="-2%">b</Span></Text>'
    )
    expect(node).toMatchObject({ lineHeight: percentLength(150), letterSpacing: percentLength(5) })
    expect(node.styleRuns[0]?.style.letterSpacing).toEqual(percentLength(-2))
    expect(warnings).toEqual([])
  })

  test('leaves out a line height or letter spacing it cannot read', async () => {
    const { node } = await renderText('<Text lineHeight="tall" letterSpacing="wide">a</Text>')
    expect(node).toMatchObject({ lineHeight: null, letterSpacing: percentLength(0) })
  })

  test('takes decoration details, auto lengths, and no fills', async () => {
    const { node, warnings } = await renderText(
      '<Text lineHeight={20} textDecoration="underline" textDecorationColor="#EE2222" textDecorationThickness={2}>a<Span lineHeight="auto" fills={[]} textDecorationStyle="wavy" textDecorationColor="currentColor" textDecorationThickness="auto" textUnderlineOffset={4} textDecorationSkipInk={false}>b</Span></Text>'
    )
    expect(node.textDecorationFills).toEqual([colorToFill('#EE2222')])
    expect(node.textDecorationThickness).toBe(2)
    expect(node.styleRuns).toEqual([
      {
        start: 1,
        length: 1,
        style: {
          lineHeight: null,
          fills: [],
          textDecorationStyle: 'WAVY',
          textDecorationFills: [],
          textDecorationThickness: null,
          textUnderlineOffset: 4,
          textDecorationSkipInk: false
        }
      }
    ])
    expect(warnings).toEqual([])
  })

  test('takes font features, variations, and language', async () => {
    const { node, warnings } = await renderText(
      '<Text fontFeatures={{ liga: false }} fontVariations={{ wght: 450 }} lang="en">a<Span fontFeatures={{ tnum: true, liga: false }} fontVariations={{ wght: 650, wdth: 90 }} lang="de">b</Span></Text>'
    )
    expect(node.fontFeatures).toEqual([{ tag: 'LIGA', enabled: false }])
    expect(node.fontVariations).toEqual([{ axis: 'wght', value: 450 }])
    expect(node.textLanguage).toBe('en')
    expect(node.styleRuns).toEqual([
      {
        start: 1,
        length: 1,
        style: {
          fontFeatures: [
            { tag: 'TNUM', enabled: true },
            { tag: 'LIGA', enabled: false }
          ],
          fontVariations: [
            { axis: 'wght', value: 650 },
            { axis: 'wdth', value: 90 }
          ],
          textLanguage: 'de'
        }
      }
    ])
    expect(warnings).toEqual([])
  })

  test('takes the optical size from fontVariations only with fontOpticalSizing none', async () => {
    const { node } = await renderText(
      '<Text fontOpticalSizing="none" fontVariations={{ opsz: 14 }}>a</Text>'
    )
    expect(node.opticalSizeFromFontSize).toBe(false)
    expect(node.fontVariations).toEqual([{ axis: 'opsz', value: 14 }])
    const auto = await renderText('<Text fontVariations={{ opsz: 14 }}>a</Text>')
    expect(auto.node.opticalSizeFromFontSize).toBe(true)
  })

  test('rejects a feature tag given twice in different cases', async () => {
    await expect(
      renderText('<Text fontFeatures={{ liga: true, LIGA: false }}>a</Text>')
    ).rejects.toThrow('Expected each feature tag once')
  })

  test('rejects a font setting tag that is not four characters', async () => {
    await expect(renderText('<Text fontFeatures={{ tabular: true }}>a</Text>')).rejects.toThrow(
      'Invalid <Text> props'
    )
  })

  test('warns about a decoration style it cannot draw', async () => {
    const { node, warnings } = await renderText('<Text textDecorationStyle="dashed">a</Text>')
    expect(node.textDecorationStyle).toBe('SOLID')
    expect(warnings[0]).toStartWith('Unknown textDecorationStyle "dashed" on <text> is ignored')
  })

  test('nests, the inner span winning', async () => {
    const { node } = await renderText(
      '<Text><Span weight={700}>a<Span weight={300} italic>b</Span></Span>c</Text>'
    )
    expect(node.text).toBe('abc')
    expect(node.styleRuns).toEqual([
      { start: 0, length: 1, style: { fontWeight: 700 } },
      { start: 1, length: 1, style: { fontWeight: 300, italic: true } }
    ])
  })

  test('joins neighbouring spans of the same style into one run', async () => {
    const { node } = await renderText(
      '<Text><Span weight={700}>a</Span><Span weight={700}>b</Span></Text>'
    )
    expect(node.styleRuns).toEqual([{ start: 0, length: 2, style: { fontWeight: 700 } }])
  })

  test('warns about props that are not character styles', async () => {
    const { warnings } = await renderText('<Text><Span w={20}>a</Span></Text>')
    expect(warnings).toEqual(['Unsupported prop "w" on <Span> is ignored.'])
  })

  test('must be inside a text', async () => {
    await expect(renderText('<Frame><Span>a</Span></Frame>')).rejects.toThrow(
      '<Span> must be inside <Text>'
    )
  })

  test('holds only text and spans', async () => {
    await expect(renderText('<Text><Span><Frame /></Span></Text>')).rejects.toThrow(
      '<Span> can hold only text and <Span>, not <frame>'
    )
  })
})

describe('Paragraph', () => {
  test('makes paragraphs with list and spacing styles', async () => {
    const { node } = await renderText(`<Text size={24}>
  <Paragraph spacing={12}>Hello <Span weight={700}>world</Span></Paragraph>
  <Paragraph list="ordered">First</Paragraph>
  <Paragraph list="ordered" level={2} listSpacing={4} indent={8}>Nested</Paragraph>
  <Paragraph list="unordered">Dot</Paragraph>
</Text>`)
    expect(node.text).toBe('Hello world\nFirst\nNested\nDot')
    expect(node.textParagraphs).toEqual([
      { listType: 'NONE', indentation: 0, paragraphSpacing: 12 },
      { listType: 'ORDERED', indentation: 1 },
      { listType: 'ORDERED', indentation: 2, listSpacing: 4, paragraphIndent: 8 },
      { listType: 'UNORDERED', indentation: 1 }
    ])
    // The newline after a bold word is bold too, as Figma styles a newline like the character before.
    expect(node.styleRuns).toEqual([{ start: 6, length: 6, style: { fontWeight: 700 } }])
  })

  test('leaves plain paragraphs at the end out', async () => {
    const { node } = await renderText(
      '<Text><Paragraph list="unordered">a</Paragraph><Paragraph>b</Paragraph><Paragraph /></Text>'
    )
    expect(node.text).toBe('a\nb\n')
    expect(node.textParagraphs).toEqual([{ listType: 'UNORDERED', indentation: 1 }])
  })

  test('gives each line of its text its style', async () => {
    const { node } = await renderText(
      `<Text><Paragraph list="unordered">{'a\\nb'}</Paragraph><Paragraph list="ordered">c</Paragraph></Text>`
    )
    expect(node.text).toBe('a\nb\nc')
    expect(node.textParagraphs.map((paragraph) => paragraph.listType)).toEqual([
      'UNORDERED',
      'UNORDERED',
      'ORDERED'
    ])
  })

  test('cannot share a text with other content', async () => {
    await expect(renderText('<Text>Intro<Paragraph>a</Paragraph></Text>')).rejects.toThrow(
      '<Text> mixes <Paragraph> with other content'
    )
    await expect(renderText('<Text><Span>a</Span><Paragraph>b</Paragraph></Text>')).rejects.toThrow(
      '<Text> mixes <Paragraph> with other content'
    )
  })

  test('is a direct child of a text', async () => {
    await expect(
      renderText('<Text><Paragraph><Paragraph>a</Paragraph></Paragraph></Text>')
    ).rejects.toThrow('<Paragraph> must be a direct child of <Text>, not of <Paragraph>')
    await expect(renderText('<Frame><Paragraph>a</Paragraph></Frame>')).rejects.toThrow(
      '<Paragraph> must be inside <Text>'
    )
  })

  test('rejects levels it cannot nest', async () => {
    await expect(
      renderText('<Text><Paragraph list="ordered" level={6}>a</Paragraph></Text>')
    ).rejects.toThrow('Invalid <Paragraph> props')
    await expect(renderText('<Text><Paragraph level={2}>a</Paragraph></Text>')).rejects.toThrow(
      '`level` nests list items; set `list` too'
    )
  })

  test('props are not layer props', async () => {
    const { warnings } = await renderText('<Text spacing={4}>a</Text>')
    expect(warnings).toEqual(['Unsupported prop "spacing" on <text> is ignored.'])
  })

  test('follows the spacing its text sets for every paragraph', async () => {
    const { node, warnings } = await renderText(
      '<Text paragraphSpacing={8} listSpacing={2} paragraphIndent={4} hangingList><Paragraph spacing={12}>a</Paragraph><Paragraph list="ordered">b</Paragraph></Text>'
    )
    expect(node).toMatchObject({
      paragraphSpacing: 8,
      listSpacing: 2,
      paragraphIndent: 4,
      hangingList: true
    })
    expect(node.textParagraphs).toEqual([
      { listType: 'NONE', indentation: 0, paragraphSpacing: 12 },
      { listType: 'ORDERED', indentation: 1 }
    ])
    expect(warnings).toEqual([])
  })
})

test('a text without spans or paragraphs keeps its text as before', async () => {
  const { node } = await renderText('<Text>{"One\\nTwo"}</Text>')
  expect(node.text).toBe('One\nTwo')
  expect(node.styleRuns).toEqual([])
  expect(node.textParagraphs).toEqual([])
})
