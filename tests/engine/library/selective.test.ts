import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  createSelectiveLibraryRevision,
  discoverPublishableLibraryChanges
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

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
    const before = [...changed.nodes].map(([id, node]) => [id, structuredClone(node)] as const)
    await discoverPublishableLibraryChanges(previous, changed)
    expect([...changed.nodes]).toEqual(before)
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
