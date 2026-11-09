import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * Writes a drag's live preview of a layer where the host's move policy (`setMovePolicy`) puts it,
 * so the person sees the constraint while dragging, not after the drop.
 */
export function previewMove(editor: Editor, id: string, changes: Partial<SceneNode>) {
  const node = editor.graph.getNode(id)
  if (!node) return
  editor.graph.updateNodePreview(id, editor.constrainMove(node, changes, { preview: true }))
}

/** Writes a layer's final position where the host's move policy puts it. */
export function writeMove(editor: Editor, id: string, changes: Partial<SceneNode>) {
  const node = editor.graph.getNode(id)
  if (!node) return
  editor.graph.updateNode(id, editor.constrainMove(node, changes))
}
