import { renderTree } from '@open-pencil/core/design-jsx'
import type { TreeNode } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'

import { convertDesignJSXRoots } from '@/app/code/sandbox/convert'
import { evaluateDesignJSX } from '@/app/code/sandbox/evaluate'
import type { EditorStore } from '@/app/editor/active-store'

export type ApplyDesignJSXResult = { ok: true; nodeIds: string[] } | { ok: false; error: string }

export async function applyDesignJSX(
  store: EditorStore,
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
  if (roots.length === 0)
    return { ok: false, error: 'Design JSX must return at least one element.' }

  const selected = [...store.state.selectedIds]
    .map((id) => store.graph.getNode(id))
    .filter((node) => node !== undefined)
    .sort((left, right) => {
      if (left.parentId !== right.parentId) return left.id.localeCompare(right.id)
      const parent = left.parentId ? store.graph.getNode(left.parentId) : undefined
      return (parent?.childIds.indexOf(left.id) ?? 0) - (parent?.childIds.indexOf(right.id) ?? 0)
    })
  const lockedSelection = selected.some(({ id, locked }) => {
    if (locked) return true
    return [...store.graph.getAllNodes()].some(
      (node) => node.locked && store.graph.isDescendant(node.id, id)
    )
  })
  if (lockedSelection) {
    return {
      ok: false,
      error: 'Unlock the selected layers and their contents before applying JSX.'
    }
  }
  const parentIds = new Set(selected.map(({ parentId }) => parentId ?? store.state.currentPageId))
  if (parentIds.size > 1) {
    return { ok: false, error: 'Select layers with the same parent before applying JSX.' }
  }
  const origins = selected.map(({ x, y }) => ({ x, y }))
  const first = selected.at(0)
  const parentId = first?.parentId ?? store.state.currentPageId
  const firstIndex = first ? (store.graph.getNode(parentId)?.childIds.indexOf(first.id) ?? -1) : -1
  const viewportCenter = store.viewportCanvasCenter()
  const origin = first ? { x: first.x, y: first.y } : viewportCenter
  const before = store.snapshotPage()

  try {
    for (const node of selected) store.graph.deleteNode(node.id)
    const results = []
    for (const [index, root] of roots.entries()) {
      const replacementOrigin = origins.at(index) ?? {
        x: origin.x + index * 24,
        y: origin.y + index * 24
      }
      const result = await renderTree(store.graph, root, {
        parentId,
        x: replacementOrigin.x,
        y: replacementOrigin.y
      })
      results.push(result)
      if (firstIndex >= 0) store.graph.insertChildAt(result.id, parentId, firstIndex + index)
    }
    const nodeIds = results.map((result) => result.id)
    computeAllLayouts(store.graph, store.state.currentPageId)
    store.select(nodeIds)
    store.requestRender()
    const after = store.snapshotPage()
    store.pushUndoEntry({
      label: selected.length > 0 ? 'Apply JSX' : 'Insert JSX',
      forward: () => {
        store.restorePageFromSnapshot(after)
        store.select(nodeIds)
      },
      inverse: () => {
        store.restorePageFromSnapshot(before)
        store.select(selected.map(({ id }) => id))
      }
    })
    return { ok: true, nodeIds }
  } catch (error) {
    store.restorePageFromSnapshot(before)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
