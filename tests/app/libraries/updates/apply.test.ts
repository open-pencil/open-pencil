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
    test(`an asset whose origin revision is ${label} stays out of the update`, async () => {
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
      const componentIds = new Map<string, string>()
      for (const key of ['button', 'badge']) {
        const { componentId } = materializeLibraryAsset(graph, first, key)
        componentIds.set(key, componentId)
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

      // The unreadable origin is not redrawn: the badge's definition keeps its stale
      // revision and the document stays pinned while a definition is left behind. The
      // selected asset still updates.
      expect(updated).toBe(true)
      const badgeId = componentIds.get('badge')
      const buttonId = componentIds.get('button')
      if (!badgeId || !buttonId) throw new Error('Expected the components')
      expect(graph.getNode(badgeId)?.librarySource?.identity.revisionId).toBe('r-stale')
      expect(graph.getNode(buttonId)?.librarySource?.identity.revisionId).toBe(
        latest.manifest.revisionId
      )
      expect(graph.enabledLibraries.get('library')?.revisionId).toBe(first.manifest.revisionId)
    })
  }
})
