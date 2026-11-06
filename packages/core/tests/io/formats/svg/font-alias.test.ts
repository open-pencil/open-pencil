import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { renderNodesToSVG, type SVGFontRequest, type SVGTextLine } from '#core/io/formats/svg'
import { fontManager } from '#core/text/font/manager'

const ALIASES: Record<string, string> = {
  'Inter\0Regular': 'EmbeddedFont0',
  'Roboto\0Bold Italic': 'EmbeddedFont1'
}

function exportText(props: Partial<SceneNode>, lines?: SVGTextLine[]): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, { width: 200, height: 60, fontSize: 20, ...props })
  const svg = renderNodesToSVG(graph, pageId, [node.id], {
    xmlDeclaration: false,
    textLayout: lines ? () => lines : undefined,
    fontAlias: ({ family, style }) => ALIASES[`${family}\0${style}`] ?? null
  })
  if (!svg) throw new Error('nothing exported')
  return svg
}

const textTag = (svg: string) => svg.match(/<text [^>]*>/)?.[0] ?? ''
const spanTags = (svg: string) => svg.match(/<tspan [^>]*>/g) ?? []

describe('SVG text with font aliases', () => {
  test('text in an aliased face names the alias at normal weight and style', () => {
    const tag = textTag(exportText({ text: 'Hello', fontFamily: 'Inter' }))
    expect(tag).toContain('font-family="EmbeddedFont0"')
    expect(tag).toContain('font-weight="normal"')
    expect(tag).toContain('font-style="normal"')
  })

  test('text without a family is aliased as the default family it is drawn in', () => {
    expect(textTag(exportText({ text: 'Hello', fontFamily: '' }))).toContain(
      'font-family="EmbeddedFont0"'
    )
  })

  test('a style run names its own face, so it does not inherit the alias of the text', () => {
    const svg = exportText({
      text: 'Plain bold styled',
      fontFamily: 'Inter',
      styleRuns: [
        { start: 0, length: 6, style: {} },
        { start: 6, length: 5, style: { fontWeight: 700 } },
        { start: 11, length: 6, style: { fontFamily: 'Roboto', fontWeight: 700, italic: true } }
      ]
    })
    const [plain, bold, styled] = spanTags(svg)
    expect(plain).toContain('font-family="EmbeddedFont0"')
    expect(bold).toContain('font-family="Inter"')
    expect(bold).toContain('font-weight="700"')
    expect(bold).toContain('font-style="normal"')
    expect(styled).toContain('font-family="EmbeddedFont1"')
    expect(styled).toContain('font-style="normal"')
  })

  test('laid-out lines name the face of each styled span', () => {
    const svg = exportText(
      {
        text: 'One two',
        fontFamily: 'Inter',
        styleRuns: [{ start: 4, length: 3, style: { fontWeight: 700 } }]
      },
      [{ start: 0, end: 7, x: 0, y: 20, width: 100 }]
    )
    expect(textTag(svg)).toContain('font-family="EmbeddedFont0"')
    expect(spanTags(svg)[1]).toContain('font-family="Inter"')
  })

  test('a fallback span names its face, at the weight the text around it is drawn at', async () => {
    // Inter is variable, so its Bold is drawn at a weight axis value.
    await fontManager.loadFont('Inter', 'Bold')
    const requests: SVGFontRequest[] = []
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('TEXT', pageId, {
      text: 'Bold 中文',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 20,
      width: 200,
      height: 60
    })
    const fallback = { family: 'Noto Sans SC', style: 'Regular', file: 0 }
    const line: SVGTextLine = {
      start: 0,
      end: 7,
      x: 0,
      y: 20,
      width: 100,
      fallbacks: new Map([
        [5, fallback],
        [6, fallback]
      ])
    }
    const svg = renderNodesToSVG(graph, pageId, [node.id], {
      xmlDeclaration: false,
      textLayout: () => [line],
      fontAlias: (font) => {
        requests.push(font)
        return `${font.family}/${font.style}`
      }
    })
    expect(spanTags(svg ?? '').map((tag) => tag.match(/font-family="([^"]*)"/)?.[1])).toEqual([
      undefined,
      'Noto Sans SC/Regular'
    ])
    // The paragraph draws every font it falls back to at the axes of the text's own.
    const request = requests.find((font) => font.family === 'Noto Sans SC')
    expect(request?.variations).toContainEqual({ axis: 'wght', value: 700 })
  })
})
