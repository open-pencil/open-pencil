import type { LibraryInstanceUpdate } from '@open-pencil/core/library'

import type { EditorStore } from '@/app/editor/session'

export interface LibraryAssetUpdateGroup {
  libraryId: string
  assetKey: string
  name: string
  plans: LibraryInstanceUpdate[]
  currentPageCount: number
  allPagesCount: number
  fallbackCount: number
}

function pageIdForNode(editor: EditorStore, nodeId: string): string | null {
  let node = editor.graph.getNode(nodeId)
  while (node?.parentId) {
    const parent = editor.graph.getNode(node.parentId)
    if (parent?.type === 'CANVAS') return parent.id
    node = parent
  }
  return null
}

export function scopeLibraryUpdateGroups(
  editor: EditorStore,
  groups: LibraryAssetUpdateGroup[],
  allPages: boolean
): LibraryAssetUpdateGroup[] {
  if (allPages) return groups
  return groups.flatMap((group) => {
    const plans = group.plans.filter(
      (plan) => pageIdForNode(editor, plan.instanceId) === editor.state.currentPageId
    )
    return plans.length > 0 ? [{ ...group, plans, currentPageCount: plans.length }] : []
  })
}
