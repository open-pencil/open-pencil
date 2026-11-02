import { describe, expect, test } from 'bun:test'

import { serializeHTML } from '#dom-css/export/html'
import { sceneNodeToDesignDocument } from '#dom-css/export/projection'
import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import { createHeadlessCSSRuntime, htmlToDesignDocument } from '#dom-css/index'

import { SceneGraph, type SceneNode, type TextParagraphStyle } from '@open-pencil/scene-graph'
import {
  paragraphSpacingAt,
  percentLength,
  pixelLength,
  textParagraphRanges
} from '@open-pencil/scene-graph/text'

async function texts(html: string): Promise<SceneNode[]> {
  const document = await htmlToDesignDocument(html, { runtime: createHeadlessCSSRuntime() })
  const graph = designDocumentToSceneGraph(document)
  return [...graph.getAllNodes()].filter((node) => node.type === 'TEXT')
}

async function roundTrip(props: Parameters<SceneGraph['createNode']>[2]) {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 16,
    width: 300,
    height: 120,
    ...props
  })
  const html = serializeHTML(sceneNodeToDesignDocument(graph, node.id, { includeSourceIds: false }))
  const [back, ...rest] = await texts(html)
  expect(rest).toHaveLength(0)
  return { node, back }
}

function spacing(node: SceneNode) {
  return textParagraphRanges(node.text).map((_, index) => [
    paragraphSpacingAt(node, index, 'paragraphSpacing'),
    paragraphSpacingAt(node, index, 'listSpacing'),
    paragraphSpacingAt(node, index, 'paragraphIndent')
  ])
}

const ordered = (indentation: number): TextParagraphStyle => ({ listType: 'ORDERED', indentation })

describe('rich text import', () => {
  test('joins inline formatting into one text with style runs', async () => {
    const [text, ...rest] = await texts(
      '<p style="font-size: 16px">Hello <strong>bold</strong> and <em style="color: #ff0000">red</em><br>next</p>'
    )
    expect(rest).toHaveLength(0)
    expect(text?.text).toBe('Hello bold and red\nnext')
    expect(text?.styleRuns).toEqual([
      { start: 6, length: 4, style: { fontWeight: 700 } },
      {
        start: 15,
        length: 3,
        style: {
          italic: true,
          fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
        }
      }
    ])
  })

  test('joins paragraphs and lists into one text, nesting by level, spacing from margins', async () => {
    const [text, ...rest] = await texts(`
      <div>
        <p style="margin: 0 0 12px">Intro</p>
        <ol style="margin: 0"><li>One<ol><li>Nested</li></ol></li><li>Two</li></ol>
        <ul><li>Dot</li></ul>
      </div>`)
    expect(rest).toHaveLength(0)
    expect(text?.text).toBe('Intro\nOne\nNested\nTwo\nDot')
    expect(
      text?.textParagraphs.map((paragraph) => [paragraph.listType, paragraph.indentation])
    ).toEqual([
      ['NONE', 0],
      ['ORDERED', 1],
      ['ORDERED', 2],
      ['ORDERED', 1],
      ['UNORDERED', 1]
    ])
    expect(text?.paragraphSpacing).toBe(12)
  })

  test('keeps the items of a flex container apart', async () => {
    const found = await texts(
      '<div style="display: flex; flex-direction: column; gap: 8px"><h2>Title</h2><p>Body</p></div>'
    )
    expect(found.map((node) => node.text)).toEqual(['Title', 'Body'])
  })

  test('reads back the runs and decorations it writes', async () => {
    const { node, back } = await roundTrip({
      text: 'Bold, dotted, offset, struck',
      styleRuns: [
        { start: 0, length: 4, style: { fontWeight: 700, fontSize: 24 } },
        {
          start: 6,
          length: 6,
          style: { textDecoration: 'UNDERLINE', textDecorationStyle: 'DOTTED' }
        },
        {
          start: 14,
          length: 6,
          style: {
            textDecoration: 'UNDERLINE',
            textUnderlineOffset: 6,
            textDecorationSkipInk: false
          }
        },
        { start: 22, length: 6, style: { textDecoration: 'STRIKETHROUGH', italic: true } }
      ]
    })
    expect(back.text).toBe(node.text)
    expect(back.styleRuns).toEqual(node.styleRuns)
  })

  test('reads back lists, spacing, indents, and empty paragraphs it writes', async () => {
    const { node, back } = await roundTrip({
      text: 'Intro\nOne\nNested a\nNested b\nTwo\n\nOutro',
      paragraphSpacing: 12,
      listSpacing: 4,
      paragraphIndent: 10,
      textParagraphs: [
        { listType: 'NONE', indentation: 0 },
        ordered(1),
        ordered(2),
        ordered(2),
        ordered(1),
        { listType: 'NONE', indentation: 0 },
        { listType: 'NONE', indentation: 0 }
      ]
    })
    expect(back.text).toBe(node.text)
    expect(
      back.textParagraphs.map((paragraph) => [paragraph.listType, paragraph.indentation])
    ).toEqual(node.textParagraphs.map((paragraph) => [paragraph.listType, paragraph.indentation]))
    expect(spacing(back)).toEqual(spacing(node))
  })

  test('reads back hanging list markers', async () => {
    const { back } = await roundTrip({
      text: 'One\nTwo',
      hangingList: true,
      textParagraphs: [ordered(1), ordered(1)]
    })
    expect(back.hangingList).toBe(true)
  })

  test('reads links in text as linked ranges, and a link of text alone as linked text', async () => {
    const [text] = await texts(
      '<p>Read <a href="https://openpencil.dev/docs">the <b>docs</b></a> now</p>'
    )
    const link = { type: 'URL' as const, value: 'https://openpencil.dev/docs' }
    expect(text?.styleRuns).toEqual([
      { start: 5, length: 4, style: { hyperlink: link } },
      { start: 9, length: 4, style: { hyperlink: link, fontWeight: 700 } }
    ])
    const [alone] = await texts('<a href="https://openpencil.dev">Home</a>')
    expect(alone?.styleRuns).toEqual([
      {
        start: 0,
        length: 4,
        style: { hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
      }
    ])
    const [rich] = await texts('<a href="https://openpencil.dev">Go <b>home</b></a>')
    expect(
      rich?.styleRuns.every((run) => run.style.hyperlink?.value === 'https://openpencil.dev')
    ).toBe(true)
    expect(rich?.styleRuns.reduce((sum, run) => sum + run.length, 0)).toBe(rich?.text.length)
  })

  test('reads text-transform on a span as the case of its characters', async () => {
    const [text] = await texts(
      '<p style="text-transform: uppercase">loud <span style="text-transform: none">quiet</span></p>'
    )
    expect(text?.textCase).toBe('UPPER')
    expect(text?.styleRuns).toEqual([{ start: 5, length: 5, style: { textCase: 'ORIGINAL' } }])
  })

  test('reads the first font family without its single or double quotes', async () => {
    const [single, double] = await texts(
      `<div style="display: flex"><span style="font-family: 'Noto Sans KR', sans-serif">a</span><span style='font-family: "Fira Code", monospace'>b</span></div>`
    )
    expect(single?.fontFamily).toBe('Noto Sans KR')
    expect(double?.fontFamily).toBe('Fira Code')
  })

  test('reads back the links and cases it writes', async () => {
    const styleRuns = [
      {
        start: 0,
        length: 4,
        style: { hyperlink: { type: 'URL' as const, value: 'https://openpencil.dev/' } }
      },
      { start: 5, length: 4, style: { textCase: 'UPPER' as const } }
    ]
    const { back } = await roundTrip({ text: 'Home loud', styleRuns })
    expect(back?.styleRuns).toEqual(styleRuns)
  })
})

// CSS keeps a line height relative as a unitless multiple and letter spacing in em, so a percent
// of the font size survives the trip, as it does in Figma.
describe('relative text lengths', () => {
  test('a unitless or percent line height and an em letter spacing read as percents', async () => {
    const [unitless, percent] = await texts(
      '<p style="font-size:20px;line-height:1.5;letter-spacing:0.1em">One</p>' +
        '<p style="font-size:20px;line-height:120%;letter-spacing:2px">Two</p>'
    )
    expect(unitless).toMatchObject({
      lineHeight: percentLength(150),
      letterSpacing: percentLength(10)
    })
    expect(percent).toMatchObject({ lineHeight: percentLength(120), letterSpacing: pixelLength(2) })
  })

  test('reads back the percents it writes, for the text and its runs', async () => {
    const { back } = await roundTrip({
      text: 'Hello world',
      lineHeight: percentLength(150),
      letterSpacing: percentLength(5),
      styleRuns: [
        { start: 6, length: 5, style: { fontWeight: 700, letterSpacing: pixelLength(1) } }
      ]
    })
    expect(back).toMatchObject({ lineHeight: percentLength(150), letterSpacing: percentLength(5) })
    expect(back.styleRuns.at(-1)?.style.letterSpacing).toEqual(pixelLength(1))
  })
})
