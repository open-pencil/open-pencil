import type { EditorStore } from '@/app/editor/session'

export interface LibraryAssetUpdateGroup {
  libraryId: string
  assetKey: string
  name: string
  instanceIds: string[]
  currentPageCount: number
  allPagesCount: number
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
    const instanceIds = group.instanceIds.filter(
      (instanceId) => pageIdForNode(editor, instanceId) === editor.state.currentPageId
    )
    return instanceIds.length > 0
      ? [{ ...group, instanceIds, currentPageCount: instanceIds.length }]
      : []
  })
}
