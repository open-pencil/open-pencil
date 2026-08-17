import type { TreeNode } from '@open-pencil/core/design-jsx'
import { renderTree } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { Vector } from '@open-pencil/scene-graph'

import { convertDesignJSXRoots } from '@/app/code/sandbox/convert'
import { evaluateDesignJSX } from '@/app/code/sandbox/evaluate'
import type { EditorStore } from '@/app/editor/active-store'

export type ApplyDesignJSXResult = { ok: true; nodeIds: string[] } | { ok: false; error: string }
export type DesignJSXEditSession = {
  originalSnapshot: ReturnType<EditorStore['snapshotPage']>
  originalSelectionIds: string[]
  targetParentId: string
  targetIndex: number
  origins: Vector[]
  fallbackOrigin: Vector
  previewSnapshot: ReturnType<EditorStore['snapshotPage']> | null
  previewNodeIds: string[]
}

function lockedSelectionError(store: EditorStore, ids: string[]): string | null {
  const locked = ids.some((id) => {
    const node = store.graph.getNode(id)
    if (node?.locked) return true
    return [...store.graph.getAllNodes()].some(
      (candidate) => candidate.locked && store.graph.isDescendant(candidate.id, id)
    )
  })
  return locked ? 'Unlock the selected layers and their contents before editing code.' : null
}

export function createDesignJSXEditSession(
  store: EditorStore
): { ok: true; session: DesignJSXEditSession } | { ok: false; error: string } {
  const selected = [...store.state.selectedIds]
    .map((id) => store.graph.getNode(id))
    .filter((node) => node !== undefined)
    .sort((left, right) => {
      if (left.parentId !== right.parentId) return left.id.localeCompare(right.id)
      const parent = left.parentId ? store.graph.getNode(left.parentId) : undefined
      return (parent?.childIds.indexOf(left.id) ?? 0) - (parent?.childIds.indexOf(right.id) ?? 0)
    })
  const lockedError = lockedSelectionError(
    store,
    selected.map(({ id }) => id)
  )
  if (lockedError) return { ok: false, error: lockedError }
  const parentIds = new Set(selected.map(({ parentId }) => parentId ?? store.state.currentPageId))
  if (parentIds.size > 1) {
    return { ok: false, error: 'Select layers with the same parent before editing code.' }
  }
  const first = selected.at(0)
  const targetParentId = first?.parentId ?? store.state.currentPageId
  const targetIndex = first
    ? (store.graph.getNode(targetParentId)?.childIds.indexOf(first.id) ?? -1)
    : -1
  return {
    ok: true,
    session: {
      originalSnapshot: store.snapshotPage(),
      originalSelectionIds: selected.map(({ id }) => id),
      targetParentId,
      targetIndex,
      origins: selected.map(({ x, y }) => ({ x, y })),
      fallbackOrigin: first ? { x: first.x, y: first.y } : store.viewportCanvasCenter(),
      previewSnapshot: null,
      previewNodeIds: []
    }
  }
}

export async function previewDesignJSX(
  store: EditorStore,
  session: DesignJSXEditSession,
  source: string
): Promise<ApplyDesignJSXResult> {
  const evaluated = await evaluateDesignJSX(source)
  if (!evaluated.ok) return evaluated

  let roots: TreeNode[]
  try {
    roots = convertDesignJSXRoots(evaluated.roots)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  store.restorePageFromSnapshot(session.originalSnapshot)
  try {
    for (const id of session.originalSelectionIds) store.graph.deleteNode(id)
    const results = []
    for (const [index, root] of roots.entries()) {
      const origin = session.origins.at(index) ?? {
        x: session.fallbackOrigin.x + index * 24,
        y: session.fallbackOrigin.y + index * 24
      }
      const result = await renderTree(store.graph, root, {
        parentId: session.targetParentId,
        x: origin.x,
        y: origin.y
      })
      results.push(result)
      if (session.targetIndex >= 0) {
        store.graph.insertChildAt(result.id, session.targetParentId, session.targetIndex + index)
      }
    }
    const nodeIds = results.map(({ id }) => id)
    computeAllLayouts(store.graph, store.state.currentPageId)
    store.select(nodeIds)
    store.requestRender()
    session.previewSnapshot = store.snapshotPage()
    session.previewNodeIds = nodeIds
    return { ok: true, nodeIds }
  } catch (error) {
    store.restorePageFromSnapshot(session.previewSnapshot ?? session.originalSnapshot)
    store.select(
      session.previewNodeIds.length > 0 ? session.previewNodeIds : session.originalSelectionIds
    )
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function resetDesignJSXPreview(store: EditorStore, session: DesignJSXEditSession): void {
  store.restorePageFromSnapshot(session.originalSnapshot)
  store.select(session.originalSelectionIds)
  session.previewSnapshot = null
  session.previewNodeIds = []
}

export function commitDesignJSXSession(store: EditorStore, session: DesignJSXEditSession): void {
  const after = session.previewSnapshot
  if (!after) return
  const previewIds = [...session.previewNodeIds]
  const originalSnapshot = session.originalSnapshot
  const originalSelectionIds = [...session.originalSelectionIds]
  store.pushUndoEntry({
    label: session.originalSelectionIds.length > 0 ? 'Edit JSX' : 'Insert JSX',
    forward: () => {
      store.restorePageFromSnapshot(after)
      store.select(previewIds)
    },
    inverse: () => {
      store.restorePageFromSnapshot(originalSnapshot)
      store.select(originalSelectionIds)
    }
  })
}
