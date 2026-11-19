import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  createSelectiveLibraryRevision,
  discoverPublishableLibraryChanges,
  MemoryLibraryCatalog
} from '@open-pencil/core/library'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session'
import { LibraryService } from '@/app/libraries/service'

function source(buttonWidth: number, includeCard = true) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    width: buttonWidth
  })
  if (includeCard)
    graph.createNode('COMPONENT', page.id, { name: 'Card', componentKey: 'card', width: 200 })
  return graph
}

function assetHash(revision: Awaited<ReturnType<typeof createLibraryRevision>>, key: string) {
  return revision.manifest.assets.find((asset) => asset.key === key)?.contentHash
}

async function initialRevision() {
  return createLibraryRevision({ libraryId: 'library', name: 'Library', graph: source(80) })
}

describe('selective library publication', () => {
  test('publishes one modification while retaining another prior asset', async () => {
    const previous = await initialRevision()
    const changed = source(120)
    const card = [...changed.getAllNodes()].find((node) => node.componentKey === 'card')
    if (!card) throw new Error('Card missing')
    changed.updateNode(card.id, { width: 240 })

    const discovery = await discoverPublishableLibraryChanges(previous, changed)
    expect(discovery.changes.map((change) => change.asset.key).sort()).toEqual(['button', 'card'])
    const next = await createSelectiveLibraryRevision({
      previous,
      sourceGraph: changed,
      selectedAssetKeys: new Set(['button']),
      name: 'Library'
    })
    expect(next.manifest.assets.map((asset) => asset.key).sort()).toEqual(['button', 'card'])
    expect(assetHash(next, 'card')).toBe(assetHash(previous, 'card'))
    expect(assetHash(next, 'button')).not.toBe(assetHash(previous, 'button'))
  })

  test('keeps skipped additions and removals pending', async () => {
    const previous = await initialRevision()
    const changed = source(120, false)
    const page = changed.getPages()[0]
    changed.createNode('COMPONENT', page.id, {
      name: 'Tooltip',
      componentKey: 'tooltip',
      width: 160
    })
    const discovery = await discoverPublishableLibraryChanges(previous, changed)
    expect(discovery.changes.map((change) => `${change.kind}:${change.asset.key}`).sort()).toEqual([
      'added:tooltip',
      'modified:button',
      'removed:card'
    ])

    const next = await createSelectiveLibraryRevision({
      previous,
      sourceGraph: changed,
      selectedAssetKeys: new Set(['button']),
      name: 'Library'
    })
    expect(next.manifest.assets.map((asset) => asset.key).sort()).toEqual(['button', 'card'])
    const pending = await discoverPublishableLibraryChanges(next, changed)
    expect(pending.changes.map((change) => `${change.kind}:${change.asset.key}`).sort()).toEqual([
      'added:tooltip',
      'removed:card'
    ])
  })

  test('applies selected additions and removals deterministically', async () => {
    const previous = await initialRevision()
    const changed = source(80, false)
    const page = changed.getPages()[0]
    changed.createNode('COMPONENT', page.id, {
      name: 'Tooltip',
      componentKey: 'tooltip',
      width: 160
    })
    const input = {
      previous,
      sourceGraph: changed,
      selectedAssetKeys: new Set(['tooltip', 'card']),
      name: 'Library',
      publishedAt: '2026-01-01T00:00:00.000Z'
    }
    const first = await createSelectiveLibraryRevision(input)
    const second = await createSelectiveLibraryRevision(input)
    expect(first.manifest.assets.map((asset) => asset.key).sort()).toEqual(['button', 'tooltip'])
    expect(first.manifest.revisionId).toBe(second.manifest.revisionId)
  })

  test('does not mutate the source while discovering changes', async () => {
    const previous = await initialRevision()
    const changed = source(120)
    const before = [...changed.nodes].map(([id, node]): [string, SceneNode] => [
      id,
      structuredClone(node)
    ])
    await discoverPublishableLibraryChanges(previous, changed)
    expect([...changed.nodes]).toEqual(before)
  })

  test('preserves nested component dependencies in retained assets', async () => {
    const sourceGraph = source(80)
    const button = [...sourceGraph.getAllNodes()].find((node) => node.componentKey === 'button')
    const card = [...sourceGraph.getAllNodes()].find((node) => node.componentKey === 'card')
    if (!button || !card) throw new Error('Components missing')
    sourceGraph.createNode('INSTANCE', card.id, { componentId: button.id })
    const previous = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: sourceGraph
    })
    const changed = source(120)
    const changedPage = changed.getPages()[0]
    changed.createNode('COMPONENT', changedPage.id, {
      name: 'Tooltip',
      componentKey: 'tooltip'
    })
    const next = await createSelectiveLibraryRevision({
      previous,
      sourceGraph: changed,
      selectedAssetKeys: new Set(['button']),
      name: 'Library'
    })
    const retainedCard = next.manifest.assets.find((asset) => asset.key === 'card')
    const retainedRoot = retainedCard ? next.graph.getNode(retainedCard.sourceId) : null
    const nested = retainedRoot
      ? next.graph.getChildren(retainedRoot.id).find((node) => node.type === 'INSTANCE')
      : null
    expect(nested?.componentId ? next.graph.getNode(nested.componentId)?.componentKey : null).toBe(
      'button'
    )
  })

  test('rejects publication when no pending change is selected', async () => {
    const previous = await initialRevision()
    expect(
      createSelectiveLibraryRevision({
        previous,
        sourceGraph: source(120),
        selectedAssetKeys: new Set(['missing']),
        name: 'Library'
      })
    ).rejects.toThrow('No library changes selected')
  })
})

/** A library whose button holds a label and an icon instance, beside a card. */
function iconLibrary() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const icon = graph.createNode('COMPONENT', page, { name: 'Icon', componentKey: 'icon' })
  graph.createNode('RECTANGLE', icon.id, { name: 'Glyph' })
  const button = graph.createNode('COMPONENT', page, {
    name: 'Button',
    componentKey: 'button',
    width: 80
  })
  graph.createNode('TEXT', button.id, { name: 'Label', text: 'Go' })
  graph.createInstance(icon.id, button.id)
  graph.createNode('COMPONENT', page, { name: 'Card', componentKey: 'card', width: 200 })
  return { graph, button }
}

/** The library layer identities of the button's layers in `revision`, by layer name. */
function buttonLayerIds(revision: Awaited<ReturnType<typeof createLibraryRevision>>) {
  const button = [...revision.graph.getAllNodes()].find(
    (node) => node.type === 'COMPONENT' && node.name === 'Button'
  )
  const ids: string[] = []
  const visit = (node: SceneNode) => {
    ids.push(`${node.name}=${node.libraryLayerId}`)
    for (const child of revision.graph.getChildren(node.id)) visit(child)
  }
  if (button) visit(button)
  return ids
}

describe('selective library publication keeps layer identities', () => {
  test('in the revision it makes', async () => {
    const { graph, button } = iconLibrary()
    const previous = await createLibraryRevision({ libraryId: 'library', name: 'Library', graph })
    graph.updateNode(button.id, { width: 120 })

    const revision = await createSelectiveLibraryRevision({
      previous,
      sourceGraph: graph,
      selectedAssetKeys: new Set(['button']),
      name: 'Library'
    })

    expect(buttonLayerIds(revision)).toEqual(buttonLayerIds(previous))
  })

  test('in the revision the library service publishes', async () => {
    const { graph, button } = iconLibrary()
    const editor = createEditorStore(graph)
    const service = new LibraryService(new MemoryLibraryCatalog())
    const input = { libraryId: 'library', name: 'Library' }
    const previous = await service.publishSelected(editor, {
      ...input,
      selectedAssetKeys: new Set(['icon', 'button', 'card'])
    })
    graph.updateNode(button.id, { width: 120 })

    const revision = await service.publishSelected(editor, {
      ...input,
      selectedAssetKeys: new Set(['button'])
    })

    expect(revision.manifest.previousRevisionId).toBe(previous.manifest.revisionId)
    expect(buttonLayerIds(revision)).toEqual(buttonLayerIds(previous))
  })
})

test('a republished style replaces the version a kept component uses', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const paint = (r: number) => [
    { type: 'SOLID' as const, color: { r, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
  ]
  const style = graph.createNode('RECTANGLE', page, {
    name: 'Surface',
    sharedStyleType: 'FILL',
    fills: paint(1)
  })
  style.source.id = 'S:surface,'
  graph.createNode('COMPONENT', page, {
    name: 'Card',
    componentKey: 'card',
    fillStyleId: 'S:surface,'
  })
  const previous = await createLibraryRevision({ libraryId: 'library', name: 'Library', graph })
  graph.updateNode(style.id, { fills: paint(0.5) })
  const { changes } = await discoverPublishableLibraryChanges(previous, graph)
  const styleKey = changes.find((change) => change.asset.type === 'STYLE')?.asset.key ?? ''

  const revision = await createSelectiveLibraryRevision({
    previous,
    sourceGraph: graph,
    selectedAssetKeys: new Set([styleKey]),
    name: 'Library'
  })

  const styles = [...revision.graph.getAllNodes()].filter((node) => node.sharedStyleType)
  expect(styles.map((node) => node.fills[0]?.color.r)).toEqual([0.5])
})
