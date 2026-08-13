import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  createLibraryRevision,
  materializeLibraryAsset,
  MemoryLibraryCatalog
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { LibraryService } from '@/app/libraries/service'

function source(width: number) {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width
  })
  return graph
}

describe('library update discovery', () => {
  test('does not materialize latest definitions while discovering updates', async () => {
    const first = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source(80),
      publishedAt: '2026-01-01T00:00:00Z'
    })
    const catalog = new MemoryLibraryCatalog()
    await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source(80),
      publishedAt: '2026-01-01T00:00:00Z'
    })
    const consumer = new SceneGraph()
    const definition = materializeLibraryAsset(consumer, first, 'button')
    consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId
    })
    const latest = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source(120),
      previousRevisionId: first.manifest.revisionId,
      publishedAt: '2026-01-02T00:00:00Z'
    })
    const editor = createEditor({ graph: consumer })
    const service = new LibraryService(catalog)
    await service.listLibraries()
    const before = [...consumer.getAllNodes()].map((node) => node.id)

    const groups = await service.getUpdateGroups(editor)

    expect(groups).toMatchObject([{ libraryId: 'library', assetKey: 'button' }])
    expect([...consumer.getAllNodes()].map((node) => node.id)).toEqual(before)
    expect(
      [...consumer.getAllNodes()].some(
        (node) => node.librarySource?.identity.revisionId === latest.manifest.revisionId
      )
    ).toBe(false)
  })
})
