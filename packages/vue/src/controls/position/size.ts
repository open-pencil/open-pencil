import { tryOnScopeDispose } from '@vueuse/core'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { layerResizes } from '@open-pencil/scene-graph/generated'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import {
  applyResizedRect,
  cancelResizePreview,
  commitResizePreview,
  scaledChanges
} from '#vue/shared/input/resize'
import { createResizeDrag } from '#vue/shared/input/resize/start'
import type { DragResize } from '#vue/shared/input/types'

type Size = Pick<Rect, 'width' | 'height'>

/** Whether a typed size moves layers inside: a frame, group, or instance a handle could resize. */
export function sizesLayersInside(node: SceneNode): boolean {
  return node.childIds.length > 0 && layerResizes(node)
}

/**
 * A typed or scrubbed width or height for layers with layers inside, resized as a handle drag
 * resizes them: each keeps its corner, and the layers inside follow their constraints from where
 * the edit began, as Figma's W and H fields place them. A multi-selection commits as one step.
 */
export function usePanelSize(editor: Editor) {
  let edits: DragResize[] | null = null

  function update(nodes: readonly SceneNode[], size: (start: Rect) => Size) {
    edits ??= nodes.map((node) => createResizeDrag(node, 'se', 0, 0, editor))
    for (const edit of edits) {
      const node = editor.graph.getNode(edit.nodeId)
      if (!node) continue
      const rect = { ...edit.origRect, ...size(edit.origRect) }
      applyResizedRect(edit, node, rect, scaledChanges(edit, node.type, rect), editor)
    }
    editor.requestRepaint()
  }

  function take() {
    const current = edits
    edits = null
    return current ?? []
  }

  /** Commits the edit in progress, if any. */
  function commit() {
    const current = take()
    if (current.length === 0) return
    editor.undo.runBatch('Resize', () => {
      for (const edit of current) commitResizePreview(edit, editor)
    })
  }

  function cancel() {
    const current = take()
    for (const edit of current) cancelResizePreview(edit, editor)
    if (current.length > 0) editor.requestRepaint()
  }

  tryOnScopeDispose(cancel)
  return { update, commit, cancel }
}
