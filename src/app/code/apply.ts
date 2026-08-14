import { renderTree } from '@open-pencil/core/design-jsx'
import type { TreeNode } from '@open-pencil/core/design-jsx'

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
  const first = selected.at(0)
  const parentId = first?.parentId ?? store.state.currentPageId
  const viewportCenter = store.viewportCanvasCenter()
  const origin = first ? { x: first.x, y: first.y } : viewportCenter
  const before = store.snapshotPage()

  try {
    for (const node of selected) store.graph.deleteNode(node.id)
    const results = []
    for (const [index, root] of roots.entries()) {
      const result = await renderTree(store.graph, root, {
        parentId,
        x: origin.x + index * 24,
        y: origin.y + index * 24
      })
      results.push(result)
    }
    const nodeIds = results.map((result) => result.id)
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
