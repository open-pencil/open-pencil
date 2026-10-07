import { beforeAll, describe, expect, it } from 'bun:test'

import {
  buildFigmaClipboardHTML,
  fontManager,
  importClipboardNodes,
  initCodec,
  parseFigmaClipboard,
  SceneGraph
} from '@open-pencil/core'
import { slotPropertyId } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

function expectFigmaEditableTextDefaults(
  textNode: NonNullable<Awaited<ReturnType<typeof parseFigmaClipboard>>>['nodes'][number]
) {
  expect(textNode.textUserLayoutVersion).toBe(4)
  expect(textNode.textExplicitLayoutVersion).toBe(1)
  expect(textNode.textBidiVersion).toBe(1)
  expect(textNode.lineHeight).toEqual({ value: 100, units: 'PERCENT' })
  expect(textNode.letterSpacing).toEqual({ value: 0, units: 'PIXELS' })
  expect(textNode.fontVariantCommonLigatures).toBe(true)
  expect(textNode.fontVariantContextualLigatures).toBe(true)
  expect(textNode.textDecorationSkipInk).toBe(true)
  expect(textNode.emojiImageSet).toBe('APPLE')
}

describe('buildFigmaClipboardHTML', () => {
  beforeAll(async () => {
    await initCodec()
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
      'bundled Inter font'
    )
    fontManager.markLoaded('Inter', 'Regular', inter)
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

  it('writes slot content and pairs every text record with its own text', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('COMPONENT', page.id, {
      name: 'Card',
      width: 200,
      height: 100,
      componentPropertyDefinitions: [
        { id: 'card:body', name: 'Body', type: 'SLOT', defaultValue: '' }
      ]
    })
    graph.createNode('FRAME', card.id, {
      name: 'Body',
      width: 200,
      height: 100,
      componentPropertyReferences: [{ propertyId: 'card:body', field: 'SLOT_CONTENT' }]
    })
    const instance = expectDefined(graph.createInstance(card.id, page.id), 'instance')
    const slot = expectDefined(
      graph.getChildren(instance.id).find((child) => slotPropertyId(child)),
      'slot'
    )
    const style = { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, width: 200, height: 24 }
    graph.createNode('TEXT', slot.id, { ...style, name: 'Slotted', text: 'In the slot' })
    graph.updateNode(instance.id, { componentPropertyAssignments: { 'card:body': '' } })
    const after = graph.createNode('TEXT', page.id, { ...style, name: 'After', text: 'Hi' })

    const parsed = await parseFigmaClipboard(
      expectDefined(await buildFigmaClipboardHTML([instance, after], graph), 'html')
    )
    const records = parsed?.nodes ?? []
    const content = records.filter((node) => node.isSlotContent === true)
    expect(content.map((node) => node.name)).toEqual(['Body'])
    for (const name of ['Slotted', 'After']) {
      const text = expectDefined(
        records.find((node) => node.name === name),
        name
      )
      const characters = text.textData?.characters ?? ''
      expect(text.derivedTextData?.logicalIndexToCharacterOffsetMap?.length).toBe(characters.length)
    }
  })

  it('keeps how text resizes, so Figma reflows it in its own font', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const create = (name: string, textAutoResize: 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'NONE') =>
      graph.createNode('TEXT', page.id, {
        name,
        width: 120,
        height: 24,
        text: 'Get started',
        fontFamily: 'Inter',
        fontSize: 16,
        textAutoResize
      })
    const nodes = [
      create('Label', 'WIDTH_AND_HEIGHT'),
      create('Body', 'HEIGHT'),
      create('Box', 'NONE')
    ]

    const html = await buildFigmaClipboardHTML(nodes, graph)
    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const autoResize = Object.fromEntries(
      (parsed?.nodes ?? [])
        .filter((node) => node.type === 'TEXT')
        .map((node) => [node.name, node.textAutoResize])
    )
    expect(autoResize).toEqual({ Label: 'WIDTH_AND_HEIGHT', Body: 'HEIGHT', Box: 'NONE' })
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

    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const textNode = parsed?.nodes.find((node) => node.type === 'TEXT')
    if (!textNode) throw new Error('Expected text node')
    expectFigmaEditableTextDefaults(textNode)
    const glyphs = textNode.derivedTextData?.glyphs ?? []
    expect(glyphs.length).toBeGreaterThan(0)
    // Bold and italic Inter are not loaded, so no glyph gets an outline from the wrong font.
    expect(glyphs.every((glyph) => glyph.commandsBlob === undefined)).toBe(true)
    expect(textNode.derivedTextData?.baselines).toHaveLength(1)
    expect(textNode.derivedTextData?.logicalIndexToCharacterOffsetMap?.length).toBe(
      text.text.length
    )
    expect(textNode.derivedTextData?.derivedLines).toEqual([{ directionality: 'LTR' }])
  })

  it('writes the fallback layout without outlines when the font is unavailable', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Title',
      x: 0,
      y: 0,
      width: 552,
      height: 70,
      text: 'Analytics Overview',
      fontFamily: 'Missing Preview Font',
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 67,
      textAutoResize: 'HEIGHT'
    })

    const html = await buildFigmaClipboardHTML(graph.getChildren(page.id), graph)
    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const textNode = parsed?.nodes.find((node) => node.type === 'TEXT')
    const baseline = textNode?.derivedTextData?.baselines?.[0]

    // The text keeps its auto-resize, so Figma reflows it in its own font instead of fixing the box.
    expect(textNode?.textAutoResize).toBe('HEIGHT')
    const glyphs = textNode?.derivedTextData?.glyphs ?? []
    expect(glyphs).toHaveLength('Analytics Overview'.length)
    expect(glyphs.every((glyph) => glyph.commandsBlob === undefined)).toBe(true)
    expect(textNode?.derivedTextData?.baselines).toHaveLength(1)
    expect(baseline?.width).toBeLessThanOrEqual(552)
    expect(baseline?.lineHeight).toBe(67)
    expect(textNode?.derivedTextData?.layoutSize).toEqual({ x: 552, y: 70 })
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

  it('preserves source metadata while importing instance overrides', async () => {
    const source = new SceneGraph()
    const sourcePage = source.getPages()[0]
    const component = source.createNode('COMPONENT', sourcePage.id, { name: 'Button' })
    source.createNode('TEXT', component.id, { name: 'Label', text: 'Effective label' })
    const instance = source.createNode('INSTANCE', sourcePage.id, {
      name: 'Button instance',
      componentId: component.id
    })
    source.populateInstanceChildren(instance.id, component.id)

    const html = await buildFigmaClipboardHTML([component, instance], source)
    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const clipboard = expectDefined(parsed, 'Figma clipboard')
    const target = new SceneGraph()
    const targetPage = target.getPages()[0]
    importClipboardNodes(clipboard.nodes, target, targetPage.id)
    const importedInstance = [...target.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === 'Button instance'
    )
    const importedLabel = importedInstance
      ? [...target.getAllNodes()].find(
          (node) => node.type === 'TEXT' && node.parentId === importedInstance.id
        )
      : undefined

    expect(importedInstance).toBeDefined()
    expect(importedLabel?.text).toBe('Effective label')
    expect(importedLabel?.source.editedFields).toEqual([])
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
