import { describe, expect, test } from 'bun:test'

import { materializeLibraryAsset, MemoryLibraryCatalog } from '@open-pencil/core/library'
import type { ComponentLibraryManifest, LibrarySummary } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session'
import {
  collectLibraryUpdateGroups,
  scopeLibraryUpdateGroups
} from '@/app/libraries/updates/groups'

function libraryGraph() {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width: 80
  })
  return graph
}

describe('library update page scopes', () => {
  test('filters grouped updates to the current page', () => {
    const graph = new SceneGraph()
    const firstPage = graph.getPages()[0]
    const secondPage = graph.addPage('Second')
    const first = graph.createNode('INSTANCE', firstPage.id)
    const second = graph.createNode('INSTANCE', secondPage.id)
    const editor = createEditorStore(graph)
    editor.state.currentPageId = firstPage.id
    const groups = [
      {
        libraryId: 'library',
        assetKey: 'button',
        name: 'Button',
        instanceIds: [first.id, second.id],
        currentPageCount: 2,
        allPagesCount: 2
      }
    ]

    expect(scopeLibraryUpdateGroups(editor, groups, false)[0]?.instanceIds).toEqual([first.id])
    expect(scopeLibraryUpdateGroups(editor, groups, true)[0]?.instanceIds).toHaveLength(2)
  })
})

describe('collectLibraryUpdateGroups', () => {
  test('reads a revision whose manifest is unavailable once, however many instances share it', async () => {
    const catalog = new MemoryLibraryCatalog()
    const first = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: libraryGraph(),
      publishedAt: '2026-01-01T00:00:00Z'
    })
    const library = libraryGraph()
    const button = [...library.getAllNodes()].find((node) => node.componentKey === 'button')
    if (!button) throw new Error('Expected the button')
    library.updateNode(button.id, { width: 120 })
    const latest = await catalog.publishRevision({
      libraryId: 'library',
      name: 'Library',
      graph: library,
      previousRevisionId: first.manifest.revisionId,
      publishedAt: '2026-01-02T00:00:00Z'
    })

    const graph = new SceneGraph()
    const { componentId } = materializeLibraryAsset(graph, first, 'button')
    const component = graph.getNode(componentId)
    if (!component?.librarySource) throw new Error('Expected the library component')
    // Every instance below comes from a revision the mirror cannot read right now.
    component.librarySource = {
      ...component.librarySource,
      identity: { ...component.librarySource.identity, revisionId: 'r-unavailable' }
    }
    for (let index = 0; index < 3; index += 1) {
      graph.createInstance(componentId, graph.getPages()[0].id)
    }
    const editor = createEditorStore(graph)

    const summaries: LibrarySummary[] = [
      {
        libraryId: 'library',
        name: 'Library',
        latestRevisionId: latest.manifest.revisionId,
        publishedAt: latest.manifest.publishedAt,
        assetCount: latest.manifest.assets.length
      }
    ]
    const reads: Array<string | undefined> = []
    const getManifest = async (
      libraryId: string,
      revisionId?: string
    ): Promise<ComponentLibraryManifest | null> => {
      reads.push(revisionId)
      if (libraryId !== 'library') throw new Error(`Unexpected library: ${libraryId}`)
      if (revisionId === latest.manifest.revisionId) return latest.manifest
      return null
    }

    const groups = await collectLibraryUpdateGroups(editor, summaries, getManifest)

    expect(groups).toEqual([])
    expect(reads.filter((revisionId) => revisionId === 'r-unavailable')).toHaveLength(1)
  })
})
