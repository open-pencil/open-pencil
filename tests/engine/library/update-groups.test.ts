import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { LibraryInstanceUpdate } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { scopeLibraryUpdateGroups } from '@/app/libraries/update-groups'

function plan(instanceId: string): LibraryInstanceUpdate {
  return { instanceId, previousComponentId: 'old', componentId: 'new', fallback: false }
}

describe('library update page scopes', () => {
  test('filters grouped updates to the current page', () => {
    const graph = new SceneGraph()
    const firstPage = graph.getPages()[0]
    const secondPage = graph.addPage('Second')
    const first = graph.createNode('INSTANCE', firstPage.id)
    const second = graph.createNode('INSTANCE', secondPage.id)
    const editor = createEditor({ graph })
    editor.state.currentPageId = firstPage.id
    const groups = [
      {
        libraryId: 'library',
        assetKey: 'button',
        name: 'Button',
        plans: [plan(first.id), plan(second.id)],
        currentPageCount: 2,
        allPagesCount: 2,
        fallbackCount: 0
      }
    ]

    expect(scopeLibraryUpdateGroups(editor, groups, false)[0]?.plans).toEqual([plan(first.id)])
    expect(scopeLibraryUpdateGroups(editor, groups, true)[0]?.plans).toHaveLength(2)
  })
})
