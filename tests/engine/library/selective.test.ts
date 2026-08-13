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

describe('selective library publication', () => {
  test('publishes one modification while retaining another prior asset', async () => {
    const previous = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source(80)
    })
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
    const retainedCard = next.manifest.assets.find((asset) => asset.key === 'card')
    const previousCard = previous.manifest.assets.find((asset) => asset.key === 'card')
    expect(retainedCard?.contentHash).toBe(previousCard?.contentHash)
    expect(next.manifest.assets.find((asset) => asset.key === 'button')?.contentHash).not.toBe(
      previous.manifest.assets.find((asset) => asset.key === 'button')?.contentHash
    )
  })
})
