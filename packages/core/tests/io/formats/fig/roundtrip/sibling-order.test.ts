import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import {
  exportFigFile,
  parseFigFile,
  populateAllFigPages,
  populateFigPage
} from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import {
  figArchive,
  registerFigArchive,
  releaseFigArchive
} from '#core/kiwi/fig/session/archive/access'
import { isReaderPagePending } from '#core/kiwi/fig/session/document-state'

setDefaultTimeout(60_000)

const SAVED_LIBRARY = ['Badge', 'Header', 'Twin', 'Card', 'Twin', 'Footer']

/**
 * A file whose two components share a page with layers between and after them, two of them named
 * alike so that a swap shows in their IDs, not their names. Each component has an instance on a
 * page of its own, so loading either page reads only its component's part of the library page.
 */
async function fixtureBytes(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const [cover] = source.getPages()
  source.updateNode(cover.id, { name: 'Cover' })
  source.createNode('RECTANGLE', cover.id, { name: 'Title', width: 40, height: 10 })
  const library = source.addPage('Library')
  const badge = source.createNode('COMPONENT', library.id, { name: 'Badge', width: 20, height: 20 })
  source.createNode('ELLIPSE', badge.id, { name: 'Dot', width: 20, height: 20 })
  source.createNode('RECTANGLE', library.id, { name: 'Header', x: 30, width: 20, height: 20 })
  source.createNode('RECTANGLE', library.id, { name: 'Twin', x: 60, width: 20, height: 20 })
  const card = source.createNode('COMPONENT', library.id, {
    name: 'Card',
    x: 90,
    width: 100,
    height: 40
  })
  source.createNode('RECTANGLE', card.id, { name: 'Body', width: 100, height: 40 })
  source.createNode('RECTANGLE', library.id, { name: 'Twin', x: 200, width: 20, height: 20 })
  source.createNode('RECTANGLE', library.id, { name: 'Footer', x: 230, width: 20, height: 20 })
  source.createInstance(card.id, source.addPage('Used').id)
  source.createInstance(badge.id, source.addPage('Badges').id)
  return exportFigFile(source)
}

const open = (bytes: Uint8Array) =>
  parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'first-page' })

function pageNamed(graph: SceneGraph, name: string): SceneNode {
  const page = graph.getPages().find((candidate) => candidate.name === name)
  if (!page) throw new Error(`Missing page ${name}`)
  return page
}

function childNamed(graph: SceneGraph, parent: SceneNode, name: string): SceneNode {
  const child = graph.getChildren(parent.id).find((candidate) => candidate.name === name)
  if (!child) throw new Error(`Missing layer ${name}`)
  return child
}

/** A page's layers in order, by ID and name: names alone miss a swap of the twins. */
function layersOf(graph: SceneGraph, pageName: string): string[] {
  return graph.getChildren(pageNamed(graph, pageName).id).map((node) => `${node.id} ${node.name}`)
}

const names = (layers: string[]) => layers.map((layer) => layer.slice(layer.indexOf(' ') + 1))

/** The saved order of the library page, as a fresh open with every page loaded reads it. */
async function savedLibrary(bytes: Uint8Array): Promise<string[]> {
  const graph = await open(bytes)
  populateAllFigPages(graph)
  const layers = layersOf(graph, 'Library')
  expect(names(layers)).toEqual(SAVED_LIBRARY)
  return layers
}

/** Writes every record, which loads the pages the document has not read into the export. */
async function reopenWhole(graph: SceneGraph): Promise<SceneGraph> {
  releaseFigArchive(graph)
  const reopened = await open(await exportFigFile(graph))
  populateAllFigPages(reopened)
  return reopened
}

describe('loading pages keeps the order of sibling layers', () => {
  test('loading the page of an instance keeps its component where it is among its siblings', async () => {
    const bytes = await fixtureBytes()
    const saved = await savedLibrary(bytes)
    const graph = await open(bytes)
    populateFigPage(graph, pageNamed(graph, 'Library').id)
    expect(layersOf(graph, 'Library')).toEqual(saved)
    populateFigPage(graph, pageNamed(graph, 'Used').id)
    expect(layersOf(graph, 'Library')).toEqual(saved)
  })

  test('loading the page of an instance keeps a reorder made on the page of its component', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    const library = pageNamed(graph, 'Library')
    populateFigPage(graph, library.id)
    graph.insertChildAt(childNamed(graph, library, 'Card').id, library.id, 0)
    const edited = layersOf(graph, 'Library')
    expect(names(edited)).toEqual(['Card', 'Badge', 'Header', 'Twin', 'Twin', 'Footer'])
    populateFigPage(graph, pageNamed(graph, 'Used').id)
    populateFigPage(graph, pageNamed(graph, 'Badges').id)
    expect(layersOf(graph, 'Library')).toEqual(edited)
  })

  test('a page first loaded for one component gets its other layers in saved order', async () => {
    const bytes = await fixtureBytes()
    const saved = await savedLibrary(bytes)
    const graph = await open(bytes)
    const library = pageNamed(graph, 'Library')
    populateFigPage(graph, pageNamed(graph, 'Used').id)
    // Only the component the instance uses is in the graph; the page itself has not loaded.
    expect(isReaderPagePending(graph, library.id)).toBe(true)
    expect(names(layersOf(graph, 'Library'))).toEqual(['Card'])
    populateFigPage(graph, library.id)
    expect(layersOf(graph, 'Library')).toEqual(saved)
  })

  test('components read for two pages keep their saved order before their page loads', async () => {
    const bytes = await fixtureBytes()
    const saved = await savedLibrary(bytes)
    const graph = await open(bytes)
    const library = pageNamed(graph, 'Library')
    // The component saved later is read first.
    populateFigPage(graph, pageNamed(graph, 'Used').id)
    populateFigPage(graph, pageNamed(graph, 'Badges').id)
    expect(isReaderPagePending(graph, library.id)).toBe(true)
    expect(names(layersOf(graph, 'Library'))).toEqual(['Badge', 'Card'])
    populateFigPage(graph, library.id)
    expect(layersOf(graph, 'Library')).toEqual(saved)
  })

  test('a whole-file save after pages loaded for components keeps the saved order', async () => {
    const bytes = await fixtureBytes()
    const saved = await savedLibrary(bytes)
    const graph = await open(bytes)
    populateFigPage(graph, pageNamed(graph, 'Used').id)
    populateFigPage(graph, pageNamed(graph, 'Badges').id)
    const cover = pageNamed(graph, 'Cover')
    graph.updateNode(childNamed(graph, cover, 'Title').id, { name: 'Title edited' })
    expect(layersOf(await reopenWhole(graph), 'Library')).toEqual(saved)
  })

  test('a save into the archive keeps a reorder made while it looks up component pages', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    const library = pageNamed(graph, 'Library')
    populateFigPage(graph, library.id)
    // An edit to the component makes the save load the page of its instance before writing it.
    const card = childNamed(graph, library, 'Card')
    graph.updateNode(graph.getChildren(card.id)[0].id, { height: 60 })
    graph.updateNode(card.id, { height: 60 })
    const archive = figArchive(graph)
    if (!archive) throw new Error('Missing archive')
    let lookups = 0
    registerFigArchive(graph, {
      ...archive,
      componentPages: async (componentIds) => {
        const pages = await archive.componentPages(componentIds)
        lookups++
        // The person editing moves a layer while the save waits for the answer.
        graph.insertChildAt(childNamed(graph, library, 'Footer').id, library.id, 0)
        return pages
      }
    })
    const exported = await exportFigFile(graph)
    expect(lookups).toBe(1)
    expect(isReaderPagePending(graph, pageNamed(graph, 'Used').id)).toBe(false)
    const edited = layersOf(graph, 'Library')
    expect(names(edited)).toEqual(['Footer', 'Badge', 'Header', 'Twin', 'Card', 'Twin'])
    const reopened = await open(exported)
    populateAllFigPages(reopened)
    expect(layersOf(reopened, 'Library')).toEqual(edited)
  })
})
