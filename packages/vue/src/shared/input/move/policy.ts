import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** A position the host's move policy (`setMovePolicy`) refused: neither axis left to write. */
const refused = (changes: Partial<SceneNode>) => changes.x === undefined && changes.y === undefined

/**
 * Writes a drag's live preview of a layer where the host's move policy puts it, so the person
 * sees the constraint while dragging; a refused move, or an axis the policy leaves out, shows the
 * layer where the drag found it.
 */
export function previewMove(editor: Editor, id: string, to: Vector, start: Vector) {
  const node = editor.graph.getNode(id)
  if (!node) return
  const decided = editor.constrainMove(node, { x: to.x, y: to.y }, { preview: true })
  // An axis the policy leaves out, or a refused move, shows where the drag found the layer.
  editor.graph.updateNodePreview(id, { x: decided.x ?? start.x, y: decided.y ?? start.y })
}

/** Where the host's move policy puts a layer's landing; null when it refuses the move. */
export function landingOf(editor: Editor, id: string, to: Vector): Partial<Vector> | null {
  const node = editor.graph.getNode(id)
  if (!node) return null
  const decided = editor.constrainMove(node, { x: to.x, y: to.y })
  return refused(decided) ? null : decided
}
