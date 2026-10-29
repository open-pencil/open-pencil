import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  isWideSticky,
  stickyScale,
  stickySublayers,
  stickyWidth
} from '@open-pencil/scene-graph/generated'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import type { DragStickyScale } from '#vue/shared/input/types'

/** The smallest scale a corner drag takes a note to, so it never folds away. */
const MIN_STICKY_SCALE = 0.1

/** The note and every layer in it, as they are now, to scale from. */
export function subtree(editor: Editor, root: SceneNode): Map<string, SceneNode> {
  const nodes = new Map<string, SceneNode>()
  const visit = (node: SceneNode) => {
    nodes.set(node.id, { ...node })
    for (const child of editor.graph.getChildren(node.id)) visit(child)
  }
  visit(root)
  return nodes
}

/** Whether a layer's handles scale it as a sticky note's do, rather than resize it. */
export function scalesByHandles(node: SceneNode): boolean {
  return node.type === 'STICKY' && !node.locked
}

/**
 * Dragging a selected sticky note's handle changes it as FigJam does: a corner, the top, or the
 * bottom scales the whole note, its text included, and a side switches it between square and
 * wide. A note has no free size, since its height follows its text.
 */
export function tryStartStickyScale(
  cx: number,
  cy: number,
  editor: Editor
): DragStickyScale | null {
  if (editor.state.selectedIds.size !== 1) return null
  const node = editor.graph.getNode([...editor.state.selectedIds][0])
  if (!node || !scalesByHandles(node)) return null
  const hit = getHitHandleByMatrix(
    cx,
    cy,
    node,
    editor.graph,
    editor.renderer?.zoom,
    editor.state.rotationPreview
  )
  if (!hit) return null
  const wide = isWideSticky(editor.graph, node)
  const drag: DragStickyScale = {
    type: 'sticky-scale',
    mode: hit.handle === 'e' || hit.handle === 'w' ? 'wide' : 'scale',
    handle: hit.handle,
    startX: cx,
    startY: cy,
    nodeId: node.id,
    origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
    originals: subtree(editor, node),
    scale: 1,
    position: { x: node.x, y: node.y },
    wide,
    commit: () => commitStickyScale(drag, editor),
    cancel: () => cancelStickyScale(drag, editor)
  }
  return drag
}

/** Shows a side drag's note at the width it snaps to, square or wide, whichever is nearer. */
function applyStickyWide(d: DragStickyScale, cx: number, editor: Editor) {
  const { origRect } = d
  const root = d.originals.get(d.nodeId)
  const scale = stickyScale(root && stickySublayers(editor.graph, root)?.author)
  const dragged = origRect.width + (d.handle === 'e' ? cx - d.startX : d.startX - cx)
  const square = stickyWidth(scale, false)
  const wide = stickyWidth(scale, true)
  d.wide = Math.abs(dragged - wide) < Math.abs(dragged - square)
  const width = d.wide ? wide : square
  const x = d.handle === 'w' ? origRect.x + origRect.width - width : origRect.x
  editor.graph.updateNodePreview(d.nodeId, { x, width })
  for (const [id, original] of d.originals) {
    if (id !== d.nodeId)
      editor.graph.updateNodePreview(id, { width: original.width + width - origRect.width })
  }
  editor.requestRepaint()
}

/** Shows the note as the handle has changed it; only the commit records it. */
export function applyStickyScale(drag: DragStickyScale, cx: number, cy: number, editor: Editor) {
  const d = toRaw(drag)
  if (d.mode === 'wide') {
    applyStickyWide(d, cx, editor)
    return
  }
  const { origRect } = d
  // The note keeps its proportions, anchored as a resize from the same handle would be.
  const rect = calculateResizeRect(
    d.handle,
    origRect,
    cx - d.startX,
    cy - d.startY,
    origRect.width / origRect.height
  )
  d.scale = Math.max(MIN_STICKY_SCALE, rect.width / origRect.width)
  d.position = { x: rect.x, y: rect.y }
  for (const [id, original] of d.originals) {
    const changes = scaleNodeChanges(original, d.scale, id !== d.nodeId)
    if (id === d.nodeId) Object.assign(changes, d.position)
    editor.graph.updateNodePreview(id, changes)
  }
  editor.requestRepaint()
}

function restoreStickyScale(d: DragStickyScale, editor: Editor) {
  for (const [id, original] of d.originals) {
    const changes = scaleNodeChanges(original, 1, id !== d.nodeId)
    if (id === d.nodeId) Object.assign(changes, { x: original.x, y: original.y })
    editor.graph.updateNodePreview(id, { ...changes, width: original.width })
  }
}

function commitStickyScale(drag: DragStickyScale, editor: Editor) {
  const d = toRaw(drag)
  restoreStickyScale(d, editor)
  if (d.mode === 'wide') editor.setStickyWide(d.nodeId, d.wide, d.handle === 'w' ? 'right' : 'left')
  else if (d.scale !== 1) editor.scaleStickyNote(d.nodeId, d.scale, d.position)
  editor.requestRender()
}

function cancelStickyScale(drag: DragStickyScale, editor: Editor) {
  restoreStickyScale(toRaw(drag), editor)
  editor.requestRender()
}
