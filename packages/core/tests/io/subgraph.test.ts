import { describe, expect, test } from 'bun:test'
import { SceneGraph } from '@open-pencil/scene-graph'
import { extractPageContext } from '#core/io/subgraph'
import { extractExportGraph } from '@open-pencil/core/io'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import type { SymbolData } from '@open-pencil/fig/instance-overrides'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { expectDefined } from '@open-pencil/test-support/assert'
import { sharedGoldPreviewFixture } from '@open-pencil/test-support/fig/fixtures'

/** A Switch set with two variants, and a card on the same page holding an Off instance. */
function cardWithSwitch() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Switch' })
  const off = graph.createNode('COMPONENT', set.id, { name: 'State=Off' })
  const on = graph.createNode('COMPONENT', set.id, { name: 'State=On' })
  const card = graph.createNode('FRAME', pageId, { name: 'Card' })
  const instance = graph.createInstance(off.id, card.id)
  if (!instance) throw new Error('No instance')
  return { graph, pageId, card, instance, off, on }
}

describe('extracting page context', () => {
  test("brings an instance's main component, or its whole set when asked", () => {
    const { graph, pageId, card, off, on } = cardWithSwitch()
    const plain = extractPageContext(graph, pageId, [card.id])
    expect(plain.getNode(off.id)).toBeDefined()
    expect(plain.getNode(on.id)).toBeUndefined()
    const withSets = extractPageContext(graph, pageId, [card.id], { componentSets: true })
    expect(withSets.getNode(on.id)).toBeDefined()
  })

  test('indexes instances by component, so the copy can sync and swap them', () => {
    const { graph, pageId, card, instance, off } = cardWithSwitch()
    const copy = extractPageContext(graph, pageId, [card.id], { componentSets: true })
    expect([...(copy.instanceIndex.get(off.id) ?? [])]).toEqual([instance.id])
  })

  test("copies the source's tables, or shares them for a read-only view", () => {
    const { graph, pageId, card } = cardWithSwitch()
    expect(extractPageContext(graph, pageId, [card.id]).variables).not.toBe(graph.variables)
    const shared = extractPageContext(graph, pageId, [card.id], { shareTables: true })
    expect(shared.variables).toBe(graph.variables)
    expect(shared.images).toBe(graph.images)
  })
})

describe('export subgraph extraction', () => {
  test('page extraction keeps the source root and page descendants', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Frame',
      x: 10,
      y: 20,
      width: 100,
      height: 100
    })
    const text = graph.createNode('TEXT', frame.id, {
      name: 'Label',
      text: 'Hello',
      width: 50,
      height: 20
    })

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })
    const extractedPages = extracted.graph.getPages(true)

    expect(extracted.graph.rootId).toBe(graph.rootId)
    expect(extractedPages.map((node) => node.id)).toEqual([page.id])
    expect(extracted.graph.getNode(page.id)?.childIds).toEqual([frame.id])
    expect(extracted.graph.getNode(frame.id)?.childIds).toEqual([text.id])
    expect(extracted.graph.getNode(text.id)?.text).toBe('Hello')
  })

  test('page extraction includes component dependencies for instances', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const libraryPage = graph.addPage('Library')
    const component = graph.createNode('COMPONENT', libraryPage.id, {
      name: 'Button',
      width: 100,
      height: 40
    })
    graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'Button',
      width: 80,
      height: 20
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })

    expect(extracted.graph.getNode(instance.id)?.type).toBe('INSTANCE')
    expect(extracted.graph.getNode(component.id)?.type).toBe('COMPONENT')
    expect(extracted.graph.getNode(libraryPage.id)?.type).toBe('CANVAS')
  })

  test('selection export carries the images strokes and video fills draw', () => {
    const graph = new SceneGraph()
    const black = { r: 0, g: 0, b: 0, a: 1 }
    graph.images.set('stroke-image', new Uint8Array([1]))
    graph.images.set('video-poster', new Uint8Array([2]))
    graph.images.set('unused', new Uint8Array([3]))
    const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      fills: [
        { type: 'VIDEO', color: black, opacity: 1, visible: true, imageHash: 'video-poster' }
      ],
      strokes: [
        {
          type: 'IMAGE',
          color: black,
          opacity: 1,
          visible: true,
          imageHash: 'stroke-image',
          weight: 2,
          align: 'INSIDE'
        }
      ]
    })

    const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds: [layer.id] })

    expect([...extracted.graph.images.keys()].sort()).toEqual(['stroke-image', 'video-poster'])
  })

  test('fig page export preserves valid instance component references without serializing instance children', async () => {
    await initCodec()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const libraryPage = graph.addPage('Library')
    const component = graph.createNode('COMPONENT', libraryPage.id, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('Expected instance')

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })
    const exported = await exportFigFile(extracted.graph)
    const parsed = await parseFigFile(exported.buffer as ArrayBuffer)
    const parsedInstance = [...parsed.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === instance.name
    )

    expect(parsedInstance?.type).toBe('INSTANCE')
    expect(parsedInstance?.componentId).toBeTruthy()
    expect(parsed.getNode(parsedInstance?.componentId ?? '')?.type).toBe('COMPONENT')

    const exportedAgain = await exportFigFile(extracted.graph)
    const reparsed = await parseFigFile(exportedAgain.buffer as ArrayBuffer)
    const reparsedInstance = [...reparsed.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === instance.name
    )
    expect(reparsedInstance?.childIds).toEqual([])
  })

  test('fig export preserves imported instance symbol overrides and guids', async () => {
    await initCodec()
    // exportFigFile clones its source, so the shared read-only parse is safe.
    const { graph } = await sharedGoldPreviewFixture()
    const exported = await exportFigFile(graph)
    const parsed = parseFigBuffer(exported.buffer as ArrayBuffer)
    const input = parsed.nodeChanges.find(
      (node) => node.guid && guidToString(node.guid) === '1:3503'
    )
    const lists = parsed.nodeChanges.find(
      (node) => node.guid && guidToString(node.guid) === '1:3491'
    )

    const inputSymbolData = input?.symbolData as SymbolData | undefined
    const listsSymbolData = lists?.symbolData as SymbolData | undefined

    expect(input?.type).toBe('INSTANCE')
    expect(inputSymbolData?.symbolOverrides?.length).toBe(9)
    expect(inputSymbolData?.uniformScaleFactor).toBeCloseTo(0.8908441662788391)
    expect(listsSymbolData?.symbolOverrides?.length).toBe(5)
  }, 15000)
})
