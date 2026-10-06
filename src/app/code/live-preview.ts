import { renderTree } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { reconcileRenderedLayers, type TreeNode } from '@open-pencil/design-jsx'
import type { SceneNode, Vector } from '@open-pencil/scene-graph'

import { convertDesignJSXRoots } from '@/app/code/sandbox/convert'
import { evaluateDesignJSX } from '@/app/code/sandbox/evaluate'
import type { EditorStore } from '@/app/editor/active-store'

/** A layer rendered from an element written on `line`, with the element's runtime type. */
export type DesignJSXLayerLine = { line: number; type: string; nodeId: string }

export type ApplyDesignJSXResult =
  | { ok: true; nodeIds: string[]; layers: DesignJSXLayerLine[] }
  | { ok: false; error: string }
export type DesignJSXEditSession = {
  /** The layers the code describes; previews update them in place. */
  rootIds: string[]
  targetParentId: string
  targetIndex: number
  origins: Vector[]
  fallbackOrigin: Vector
  /** The page before the edit, which Reset brings back. */
  originalSnapshot: ReturnType<EditorStore['snapshotPage']>
  originalSelectionIds: string[]
  /** Previews of one edit coalesce into a single undo step. */
  undoKey: string
}

let sessionCount = 0

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
      rootIds: selected.map(({ id }) => id),
      targetParentId,
      targetIndex,
      origins: selected.map(({ x, y }) => ({ x, y })),
      fallbackOrigin: first ? { x: first.x, y: first.y } : store.viewportCanvasCenter(),
      originalSnapshot: store.snapshotPage(),
      originalSelectionIds: selected.map(({ id }) => id),
      undoKey: `design-jsx-edit:${++sessionCount}`
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
    roots = convertDesignJSXRoots(evaluated.roots, evaluated.lineOffsets)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const before = store.snapshotPage()
  const selectionBefore = [...store.state.selectedIds]
  try {
    const renderedIds: string[] = []
    const layers: DesignJSXLayerLine[] = []
    const onNode = (tree: TreeNode, node: { id: string }) => {
      if (tree.source) layers.push({ line: tree.source.line, type: tree.type, nodeId: node.id })
    }
    for (const [index, root] of roots.entries()) {
      const origin = session.origins.at(index) ?? {
        x: session.fallbackOrigin.x + index * 24,
        y: session.fallbackOrigin.y + index * 24
      }
      // Code that places a root keeps it there; code that does not lands where the layer was.
      const result = await renderTree(store.graph, root, {
        parentId: session.targetParentId,
        x: 'x' in root.props ? undefined : origin.x,
        y: 'y' in root.props ? undefined : origin.y,
        onNode
      })
      renderedIds.push(result.id)
    }
    const { rootIds, ids } = reconcileRenderedLayers(store.graph, session.rootIds, renderedIds)
    if (session.targetIndex >= 0) {
      for (const [index, id] of rootIds.entries()) {
        store.graph.insertChildAt(id, session.targetParentId, session.targetIndex + index)
      }
    }
    computeAllLayouts(store.graph, store.state.currentPageId)
    session.rootIds = rootIds
    if (!sameIds(selectionBefore, rootIds)) store.select(rootIds)
    store.requestRender()
    recordPreview(store, session, before, selectionBefore)
    return {
      ok: true,
      nodeIds: rootIds,
      layers: layers.map((layer) => ({ ...layer, nodeId: ids.get(layer.nodeId) ?? layer.nodeId }))
    }
  } catch (error) {
    store.restorePageFromSnapshot(before)
    store.select(selectionBefore)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Applies canvas edits made while the code waited to render, which its preview drew over. They
 * came after the code, so they win, and join the edit's undo step. Layers the preview removed
 * are skipped.
 */
export function reapplyCanvasEdits(
  store: EditorStore,
  session: DesignJSXEditSession,
  edits: ReadonlyMap<string, Partial<SceneNode>>
): void {
  const present = [...edits].filter(([id]) => store.graph.getNode(id))
  if (present.length === 0) return
  const before = store.snapshotPage()
  const selection = [...store.state.selectedIds]
  for (const [id, changes] of present) store.graph.updateNode(id, changes)
  computeAllLayouts(store.graph, store.state.currentPageId)
  store.requestRender()
  recordPreview(store, session, before, selection)
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/** One undo step per edit: consecutive previews of a session coalesce into the first one. */
function recordPreview(
  store: EditorStore,
  session: DesignJSXEditSession,
  before: ReturnType<EditorStore['snapshotPage']>,
  selectionBefore: string[]
): void {
  const after = store.snapshotPage()
  const rootIds = [...session.rootIds]
  store.pushUndoEntry({
    label: session.originalSelectionIds.length > 0 ? 'Edit JSX' : 'Insert JSX',
    coalesceKey: session.undoKey,
    forward: () => {
      store.restorePageFromSnapshot(after)
      store.select(rootIds)
    },
    inverse: () => {
      store.restorePageFromSnapshot(before)
      store.select(selectionBefore)
    }
  })
}

/** Brings back the page from before the edit, as one undo step. */
export function resetDesignJSXPreview(store: EditorStore, session: DesignJSXEditSession): void {
  const before = store.snapshotPage()
  const selectionBefore = [...store.state.selectedIds]
  const { originalSnapshot, originalSelectionIds } = session
  store.restorePageFromSnapshot(originalSnapshot)
  store.select(originalSelectionIds)
  session.rootIds = [...originalSelectionIds]
  store.pushUndoEntry({
    label: 'Reset JSX',
    forward: () => {
      store.restorePageFromSnapshot(originalSnapshot)
      store.select(originalSelectionIds)
    },
    inverse: () => {
      store.restorePageFromSnapshot(before)
      store.select(selectionBefore)
    }
  })
}
