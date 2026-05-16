import { beforeAll, describe, expect, it } from 'bun:test'

import {
  buildFigmaClipboardHTML,
  importClipboardNodes,
  initCodec,
  parseFigmaClipboard,
  SceneGraph
} from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

describe('buildFigmaClipboardHTML', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('encodes a simple frame without throwing', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Card',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).toContain('figmeta')
    expect(html).toContain('figma')
  })

  it('encodes text nodes with style runs', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Styled',
      x: 0,
      y: 0,
      width: 200,
      height: 24,
      text: 'Hello World',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      styleRuns: [
        { start: 0, length: 5, style: { fontWeight: 700 } },
        { start: 6, length: 5, style: { fontWeight: 400, italic: true } }
      ]
    })

    const html = await buildFigmaClipboardHTML([text], graph)
    expect(html).toContain('figmeta')

    const parsed = await parseFigmaClipboard(html)
    const textNode = parsed?.nodes.find((node) => node.type === 'TEXT')
    expect(textNode?.textUserLayoutVersion).toBe(4)
    expect(textNode?.derivedTextData?.glyphs).toBeDefined()
    expect(textNode?.derivedTextData?.baselines?.length).toBeGreaterThan(0)
  })

  it('encodes auto-layout frames', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Row',
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).toContain('figmeta')
  })

  it('roundtrips: encode then decode back', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Analytics Overview',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      cornerRadius: 12
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Title',
      x: 0,
      y: 0,
      width: 260,
      height: 24,
      text: 'Analytics Overview',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 18
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Subtitle',
      x: 0,
      y: 0,
      width: 260,
      height: 40,
      text: 'Track your key metrics and performance indicators in real time.',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).not.toBeNull()

    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const clipboard = expectDefined(parsed, 'Figma clipboard')
    expect(clipboard.nodes.length).toBeGreaterThan(0)

    const graph2 = new SceneGraph()
    const page2 = graph2.getPages()[0]
    const created = importClipboardNodes(clipboard.nodes, graph2, page2.id)
    expect(created).toHaveLength(1)

    const imported = expectDefined(graph2.getNode(created[0]), 'imported clipboard node')
    expect(imported.name).toBe('Analytics Overview')
    expect(imported.cornerRadius).toBe(12)

    const children = graph2.getChildren(imported.id)
    expect(children).toHaveLength(2)
    expect(children[0].text).toBe('Analytics Overview')
    expect(children[1].text).toContain('Track your key metrics')
  })
})
