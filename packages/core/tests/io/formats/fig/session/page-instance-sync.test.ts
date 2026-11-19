import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { createFigDocumentSession } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

test('loading a later page keeps the derived sizes of instances earlier pages placed', async () => {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const component = source.createNode('COMPONENT', first.id, { name: 'Field', width: 200 })
  source.createNode('RECTANGLE', component.id, { name: 'Box', width: 100, height: 20 })
  const placed = source.createInstance(component.id, first.id)
  if (!placed) throw new Error('Missing instance')
  // The instance's box is wider than the component's, as a fill child of a resized instance is;
  // export saves that as the size Figma derived for it.
  const box = source.getChildren(placed.id)[0]
  source.updateNode(box.id, { width: 150 })
  source.createInstance(component.id, source.addPage('Second').id)
  const bytes = await exportFigFile(source)

  // The app's sessions read the sizes Figma derived, as this one does.
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer, { derivedBounds: true })
  session.loadPage(session.pages[0].id)
  const firstPageId = session.graphPageId(session.pages[0].id)
  const instance = session.graph
    .getChildren(firstPageId ?? '')
    .find((node) => node.type === 'INSTANCE')
  if (!instance) throw new Error('Missing loaded instance')
  const loadedBox = () => session.graph.getChildren(instance.id)[0]
  expect(loadedBox().width).toBe(150)

  session.loadPage(session.pages[1].id)
  expect(loadedBox().width).toBe(150)
})

test('loading a later page keeps a live edit to a nested instance layer over its derived size', async () => {
  await initCodec()
  const source = new SceneGraph()
  const library = source.getPages()[0]
  const inner = source.createNode('COMPONENT', library.id, { name: 'Inner', width: 100 })
  source.createNode('RECTANGLE', inner.id, { name: 'Box', width: 100, height: 20 })
  const outer = source.createNode('COMPONENT', library.id, { name: 'Outer', width: 300 })
  const layer = source.createInstance(inner.id, outer.id)
  if (!layer) throw new Error('Missing nested instance layer')
  const placed = source.createInstance(outer.id, source.addPage('Placed').id)
  if (!placed) throw new Error('Missing placed instance')
  // Figma derived a wider nested instance in the placed copy, as a fill child would be.
  const nested = source.getChildren(placed.id)[0]
  source.updateNode(nested.id, { width: 150 })
  const bytes = await exportFigFile(source)

  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer, { derivedBounds: true })
  session.loadPage(session.pages[0].id)
  const libraryId = session.graphPageId(session.pages[0].id) ?? ''
  const loadedOuter = session.graph.getChildren(libraryId).find((node) => node.name === 'Outer')
  const loadedLayer = loadedOuter ? session.graph.getChildren(loadedOuter.id)[0] : undefined
  if (!loadedLayer) throw new Error('Missing loaded nested instance layer')
  // Editing the component's layer live, after the file opened.
  session.graph.updateNode(loadedLayer.id, { width: 120 })
  expect(session.graph.getNode(loadedLayer.id)?.source.editedFields).toContain('width')

  const placedPage = session.pages.find((page) => page.name === 'Placed')
  if (!placedPage) throw new Error('Missing placed page')
  session.loadPage(placedPage.id)
  const placedId = session.graphPageId(placedPage.id) ?? ''
  const loadedPlaced = session.graph.getChildren(placedId)[0]
  expect(session.graph.getChildren(loadedPlaced.id)[0].width).toBe(120)
})

async function sessionWithPlacedInstances() {
  await initCodec()
  const source = new SceneGraph()
  const library = source.getPages()[0]
  const component = source.createNode('COMPONENT', library.id, { name: 'Badge' })
  source.createNode('TEXT', component.id, { name: 'Label', text: 'Badge' })
  const page = source.addPage('Placed')
  for (let index = 0; index < 8; index++) source.createInstance(component.id, page.id)
  const bytes = await exportFigFile(source)

  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  const synced: string[] = []
  const wholeComponents: string[] = []
  const syncInstance = session.graph.syncInstance.bind(session.graph)
  session.graph.syncInstance = (instanceId: string) => {
    synced.push(instanceId)
    return syncInstance(instanceId)
  }
  const syncInstances = session.graph.syncInstances.bind(session.graph)
  session.graph.syncInstances = (componentId: string) => {
    wholeComponents.push(componentId)
    return syncInstances(componentId)
  }
  const pageNamed = (name: string) => {
    const found = session.pages.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`Missing page ${name}`)
    return found
  }
  const loadPlaced = () => {
    const placed = pageNamed('Placed')
    session.loadPage(placed.id)
    const pageId = session.graphPageId(placed.id)
    if (!pageId) throw new Error('Missing materialized page')
    return session.graph.getChildren(pageId)
  }
  return { session, synced, wholeComponents, pageNamed, loadPlaced }
}

/**
 * Syncing a whole component visits every instance of it in the graph, including those earlier
 * pages placed, whose sizes Figma derived. A page loaded into an edited graph syncs only the
 * instances it places, each once.
 */
test('a page load into an edited graph syncs each instance it places once, never a whole component', async () => {
  const { session, synced, wholeComponents, pageNamed, loadPlaced } =
    await sessionWithPlacedInstances()
  session.loadPage(pageNamed('Page 1').id)
  const libraryId = session.graphPageId(pageNamed('Page 1').id) ?? ''
  const component = session.graph.getChildren(libraryId)[0]
  session.graph.updateNode(component.id, { name: 'Badge 2' })

  const instances = loadPlaced()
  expect(instances).toHaveLength(8)
  expect(wholeComponents).toEqual([])
  expect(synced.toSorted()).toEqual(instances.map((instance) => instance.id).toSorted())
  for (const instance of instances)
    expect(session.graph.getChildren(instance.id)[0].text).toBe('Badge')
})

/**
 * Nothing in a graph only page loads and their layout wrote can differ from the file, so a
 * page load has nothing to reconcile its instances with; on a design kit that sync was most
 * of the time a large page took to load.
 */
test('a page load into a graph only loads and derived layout wrote syncs no instances', async () => {
  const { session, synced, wholeComponents, pageNamed, loadPlaced } =
    await sessionWithPlacedInstances()
  session.loadPage(pageNamed('Page 1').id)
  const libraryId = session.graphPageId(pageNamed('Page 1').id) ?? ''
  const component = session.graph.getChildren(libraryId)[0]
  session.graph.applyDerivedLayoutDuring(() =>
    session.graph.updateNode(component.id, { height: component.height + 1 })
  )

  const instances = loadPlaced()
  expect(instances).toHaveLength(8)
  expect(synced).toEqual([])
  expect(wholeComponents).toEqual([])
  for (const instance of instances)
    expect(session.graph.getChildren(instance.id)[0].text).toBe('Badge')
})

async function openBadgeWithPlacedInstance() {
  await initCodec()
  const source = new SceneGraph()
  const component = source.createNode('COMPONENT', source.getPages()[0].id, {
    name: 'Badge',
    width: 100
  })
  source.createInstance(component.id, source.addPage('Placed').id)
  const bytes = await exportFigFile(source)
  const graph = await parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'first-page' })
  const [libraryPage, placedPage] = graph.getPages()
  return {
    graph,
    editor: createEditor({ graph }),
    badge: graph.getChildren(libraryPage.id)[0],
    placedPage
  }
}

test('a page load while a node preview runs takes no values from the preview', async () => {
  const { graph, editor, badge, placedPage } = await openBadgeWithPlacedInstance()
  try {
    const preview = editor.beginNodePreview('Resize')
    preview.update(badge.id, { width: 300 })
    expect(populateFigPage(graph, placedPage.id)).toBe(true)
    preview.cancel()

    expect(graph.getChildren(placedPage.id)[0].width).toBe(100)
  } finally {
    editor.dispose()
  }
})

test('a page load after a node preview commits gives its instances the committed value', async () => {
  const { graph, editor, badge, placedPage } = await openBadgeWithPlacedInstance()
  try {
    const preview = editor.beginNodePreview('Resize')
    preview.update(badge.id, { width: 300 })
    preview.commit()
    expect(populateFigPage(graph, placedPage.id)).toBe(true)

    expect(graph.getChildren(placedPage.id)[0].width).toBe(300)
  } finally {
    editor.dispose()
  }
})
