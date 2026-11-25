import { describe, expect, test } from 'bun:test'

import {
  materializeLibraryAsset,
  MemoryLibraryCatalog,
  type ComponentLibraryRevision,
  type LibraryCatalog
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session'
import { LibraryContentFailedError, LibraryContentSyncingError } from '@/app/libraries/errors'
import { updateLibraryDefinitionsInPlace } from '@/app/libraries/updates/apply'

function libraryGraph() {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width: 80
  })
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Badge',
    componentKey: 'badge'
  })
  return graph
}

/**
 * A reader over `catalog` that answers `libraryId`'s latest and `knownRevision`, and reports
 * every other revision with `error` — the mirror state where an instance's origin revision
 * cannot be compared.
 */
function partialReader(
  catalog: LibraryCatalog,
  libraryId: string,
  latest: ComponentLibraryRevision,
  knownRevision: string,
  error: Error
) {
  return async (id: string, revisionId?: string): Promise<ComponentLibraryRevision> => {
    if (id !== libraryId) throw new Error(`Unexpected library: ${id}`)
    const resolved = revisionId ?? latest.manifest.revisionId
    if (resolved === latest.manifest.revisionId || resolved === knownRevision) {
      return catalog.getRevision(id, resolved)
    }
    throw error
  }
}

describe('updateLibraryDefinitionsInPlace', () => {
  for (const [label, error] of [
    ['still syncing', new LibraryContentSyncingError('library', 'r-stale')],
    ['marked failed', new LibraryContentFailedError('library', 'r-stale')]
  ] as const) {
    test(`an asset whose origin revision is ${label} counts as changed`, async () => {
      const catalog = new MemoryLibraryCatalog()
      const first = await catalog.publishRevision({
        libraryId: 'library',
        name: 'Library',
        graph: libraryGraph()
      })
      const library = libraryGraph()
      const button = [...library.getAllNodes()].find((node) => node.componentKey === 'button')
      if (!button) throw new Error('Expected the button')
      library.updateNode(button.id, { width: 120 })
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
      // The badge's origin revision is one the mirror never resolved.
      for (const node of graph.getAllNodes()) {
        const source = node.librarySource
        if (source?.identity.assetKey === 'badge') {
          node.librarySource = {
            ...source,
            identity: { ...source.identity, revisionId: 'r-stale' }
          }
        }
      }
      const editor = createEditorStore(graph)
      const read = partialReader(catalog, 'library', latest, first.manifest.revisionId, error)

      const updated = await updateLibraryDefinitionsInPlace(
        editor,
        new Map([['library', new Set(['button'])]]),
        'Update library',
        read
      )

      // The unreadable origin counted as changed, so every asset updated and the binding
      // moved onto the latest revision instead of staying pinned behind.
      expect(updated).toBe(true)
      expect(graph.enabledLibraries.get('library')?.revisionId).toBe(latest.manifest.revisionId)
    })
  }
})
