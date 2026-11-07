import { describe, expect, test } from 'bun:test'

import { until } from '@vueuse/core'

import { materializeLibraryAsset, MemoryLibraryCatalog } from '@open-pencil/core/library'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { LibraryService } from '@/app/libraries/service'

function source(width: number, label: string) {
  const graph = new SceneGraph()
  const button = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width
  })
  graph.createNode('TEXT', button.id, { name: 'Label', text: label })
  return graph
}

/** The library widens its button, relabels it and adds a badge. */
function widen(library: SceneGraph, button: SceneNode) {
  library.updateNode(button.id, { width: 120 })
  library.updateNode(library.getChildren(button.id)[0]?.id ?? '', { text: 'New' })
  library.createNode('TEXT', button.id, { name: 'Badge', text: '1' })
}

/** A library whose button is a set holding one variant, with no key of its own. */
function variants() {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button'
  })
  const variant = graph.createNode('COMPONENT', set.id, { name: 'Size=Large', width: 80 })
  graph.createNode('TEXT', variant.id, { name: 'Label', text: 'Old' })
  return graph
}

/**
 * A document holding an overridden instance of a library button, with a newer revision published
 * that makes the changes `revise` makes.
 */
async function updatable(
  revise: (library: SceneGraph, button: SceneNode) => void = widen,
  library = source(80, 'Old')
) {
  const catalog = new MemoryLibraryCatalog()
  const first = await catalog.publishRevision({
    libraryId: 'library',
    name: 'Library',
    graph: library,
    publishedAt: '2026-01-01T00:00:00Z'
  })
  const button = [...library.getAllNodes()].find((node) => node.componentKey === 'button')
  if (!button) throw new Error('Expected the button')
  revise(library, button)
  const latest = await catalog.publishRevision({
    libraryId: 'library',
    name: 'Library',
    graph: library,
    previousRevisionId: first.manifest.revisionId,
    publishedAt: '2026-01-02T00:00:00Z'
  })
  const graph = new SceneGraph()
  const { componentId } = materializeLibraryAsset(graph, first, 'button')
  const instance = graph.createInstance(componentId, graph.getPages()[0].id)
  const label = instance ? graph.getChildren(instance.id)[0] : undefined
  if (!instance || !label) throw new Error('Expected the instance and its label')
  graph.updateNode(label.id, { text: 'Hello' })
  recordInstanceOverride(graph, label.id, ['text'])
  const editor = createEditorStore(graph)
  const service = new LibraryService(catalog)
  await service.listLibraries()
  await service.refresh(editor)
  return {
    graph,
    instance,
    componentId,
    editor,
    service,
    catalog,
    latest: latest.manifest.revisionId
  }
}

describe('library service updates', () => {
  test('redraws a library in place, keeping an instance’s component and overrides through undo and redo', async () => {
    const { graph, instance, componentId, editor, service } = await updatable()

    await service.applyUpdate(editor, 'library')
    expect(graph.getNode(instance.id)?.componentId).toBe(componentId)
    expect(graph.getNode(instance.id)?.width).toBe(120)
    expect(graph.getChildren(instance.id)[0]?.text).toBe('Hello')

    editor.undo.undo()
    expect(graph.getNode(componentId)?.width).toBe(80)
    expect(graph.getNode(instance.id)?.width).toBe(80)
    expect(graph.getChildren(instance.id)[0]?.text).toBe('Hello')

    editor.undo.redo()
    expect(graph.getNode(instance.id)?.width).toBe(120)
    expect(graph.getChildren(instance.id)[0]?.text).toBe('Hello')
  })

  test('offers an update again once it is undone, and none once it is redone', async () => {
    const { editor, service, latest } = await updatable()
    setActiveEditorStore(editor)
    const offered = () => service.updates.value.map((update) => update.libraryId)
    const inserted = () => service.enabledAssets.value.map((asset) => asset.revisionId)

    await service.applyUpdate(editor, 'library')
    expect(offered()).toEqual([])

    editor.undo.undo()
    await until(service.updates).toMatch((updates) => updates.length > 0)
    expect(offered()).toEqual(['library'])
    expect(inserted()).not.toContain(latest)

    editor.undo.redo()
    await until(service.updates).toMatch((updates) => updates.length === 0)
    expect(inserted()).toEqual([latest])
  })

  test('redoes an update as it left the document, so the layers it added keep their IDs', async () => {
    const { graph, instance, editor, service } = await updatable()
    const badges = () =>
      graph
        .getChildren(instance.id)
        .filter((node) => node.name === 'Badge')
        .map((node) => node.id)

    await service.applyUpdate(editor, 'library')
    const added = badges()
    expect(added).toHaveLength(1)

    editor.undo.undo()
    expect(badges()).toEqual([])
    editor.undo.redo()
    expect(badges()).toEqual(added)
  })

  test('moves the instances of a button the library turns into a set of variants', async () => {
    const { graph, instance, componentId, editor, service, latest } = await updatable(
      (library, button) => {
        const set = library.createNode('COMPONENT_SET', library.getPages()[0].id, {
          name: 'Button',
          componentKey: 'button'
        })
        library.updateNode(button.id, { name: 'Size=Large', componentKey: 'button-large' })
        library.insertChildAt(button.id, set.id, 0)
      }
    )

    await service.applyUpdate(editor, 'library')
    const moved = graph.getNode(graph.getNode(instance.id)?.componentId ?? '')
    expect(moved?.name).toBe('Size=Large')
    expect(moved?.librarySource?.identity.revisionId).toBe(latest)
    expect(graph.enabledLibraries.get('library')?.revisionId).toBe(latest)

    editor.undo.undo()
    expect(graph.getNode(instance.id)?.componentId).toBe(componentId)
  })

  test('moves the instances of a keyless variant whose set the library turns into a component', async () => {
    const { graph, instance, componentId, editor, service, latest } = await updatable(
      (library, set) => {
        library.deleteNode(set.id)
        const button = library.createNode('COMPONENT', library.getPages()[0].id, {
          name: 'Button',
          componentKey: 'button',
          width: 120
        })
        library.createNode('TEXT', button.id, { name: 'Label', text: 'New' })
      },
      variants()
    )

    await service.applyUpdate(editor, 'library')
    const moved = graph.getNode(graph.getNode(instance.id)?.componentId ?? '')
    expect(moved?.librarySource?.identity).toMatchObject({ assetKey: 'button', revisionId: latest })
    expect(graph.getNode(instance.id)?.width).toBe(120)

    editor.undo.undo()
    expect(graph.getNode(instance.id)?.componentId).toBe(componentId)
  })

  test('leaves no step to undo when the library has no update left', async () => {
    const { graph, instance, editor, service } = await updatable()

    await service.applyUpdate(editor, 'library')
    await service.applyUpdate(editor, 'library')
    editor.undo.undo()
    expect(graph.getNode(instance.id)?.width).toBe(80)
  })

  test('redraws an asset group in place, keeping its instances’ components and overrides', async () => {
    const { graph, instance, componentId, editor, service } = await updatable()
    const [group] = await service.getUpdateGroups(editor)
    if (!group) throw new Error('Expected an update group')

    await service.applyUpdateGroups(editor, [group])
    expect(graph.getNode(instance.id)?.componentId).toBe(componentId)
    expect(graph.getNode(instance.id)?.width).toBe(120)
    expect(graph.getChildren(instance.id)[0]?.text).toBe('Hello')
  })

  test('moves the document onto the revision when the group it applies is the only change', async () => {
    const library = source(80, 'Old')
    library.createNode('COMPONENT', library.getPages()[0].id, {
      name: 'Badge',
      componentKey: 'badge'
    })
    const catalog = new MemoryLibraryCatalog()
    const first = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: library
    })
    const button = [...library.getAllNodes()].find((node) => node.componentKey === 'button')
    if (!button) throw new Error('Expected the button')
    widen(library, button)
    const latest = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: library,
      previousRevisionId: first.manifest.revisionId
    })
    const graph = new SceneGraph()
    for (const key of ['button', 'badge']) {
      const { componentId } = materializeLibraryAsset(graph, first, key)
      graph.createInstance(componentId, graph.getPages()[0].id)
    }
    const editor = createEditorStore(graph)
    const service = new LibraryService(catalog)
    await service.listLibraries()
    await service.refresh(editor)

    const groups = await service.getUpdateGroups(editor)
    expect(groups.map((group) => group.assetKey)).toEqual(['button'])
    await service.applyUpdateGroups(editor, groups)

    expect(graph.enabledLibraries.get('library')?.revisionId).toBe(latest.manifest.revisionId)
  })

  test('leaves the document as it was when an update of some assets cannot be drawn', async () => {
    const library = new SceneGraph()
    const page = library.getPages()[0].id
    const a = library.createNode('COMPONENT', page, { name: 'A', componentKey: 'a' })
    const b = library.createNode('COMPONENT', page, { name: 'B', componentKey: 'b' })
    const nested = library.createInstance(b.id, a.id)
    const catalog = new MemoryLibraryCatalog()
    const first = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: library
    })
    // The library turns the dependency around: B now uses A, and A no longer uses B.
    if (nested) library.deleteNode(nested.id)
    library.createInstance(a.id, b.id)
    await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: library,
      previousRevisionId: first.manifest.revisionId
    })
    const graph = new SceneGraph()
    for (const key of ['a', 'b']) {
      const { componentId } = materializeLibraryAsset(graph, first, key)
      graph.createInstance(componentId, graph.getPages()[0].id)
    }
    const editor = createEditorStore(graph)
    const service = new LibraryService(catalog)
    await service.listLibraries()
    await service.refresh(editor)
    const state = () => ({
      nodes: [...graph.nodes.values()].map((node) => structuredClone(node)),
      libraries: structuredClone(graph.enabledLibraries)
    })
    const before = state()

    const groups = (await service.getUpdateGroups(editor)).filter((group) => group.assetKey === 'b')
    await expect(service.applyUpdateGroups(editor, groups)).rejects.toThrow(
      'Cyclic component synchronization dependency'
    )

    expect(state()).toEqual(before)
    expect(editor.undo.canUndo).toBe(false)
  })
})

test('a library change in a document in the background leaves the shown one’s state', async () => {
  const { editor, service } = await updatable()
  const background = createEditorStore(new SceneGraph())
  await service.refresh(background)
  await service.refresh(editor)
  setActiveEditorStore(editor)
  const refreshed: EditorStore[] = []
  const refresh = service.refresh.bind(service)
  service.refresh = (store) => {
    refreshed.push(store)
    return refresh(store)
  }

  background.refreshDocumentSettings()
  editor.refreshDocumentSettings()

  // Labels, not the stores: a failure would otherwise print two whole editors.
  expect(refreshed.map((store) => (store === editor ? 'shown' : 'background'))).toEqual(['shown'])
})

test('a read of the libraries that finishes after a newer one leaves the newer one’s state', async () => {
  const { editor, catalog } = await updatable()
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let reads = 0
  const listLibraries = catalog.listLibraries.bind(catalog)
  catalog.listLibraries = async () => {
    // The first read waits until the second has finished.
    if (++reads === 1) await held
    return listLibraries()
  }
  const service = new LibraryService(catalog)
  const other = createEditorStore(new SceneGraph())

  const stale = service.refresh(editor)
  await service.refresh(other)
  release()
  await stale

  expect(service.enabledAssets.value).toEqual([])
  expect(service.updates.value).toEqual([])
})
