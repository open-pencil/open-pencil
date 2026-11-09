import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import { resolveEditorProfile } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  getAbsolutePosition,
  getAxisAlignedWorldBounds,
  getParentWorldMatrix
} from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { canRescaleNode, isInsideInstance, scaleNodeChanges } from '@open-pencil/scene-graph/scaling'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import { selectionResizeHandleAt } from '#vue/shared/input/resize/selection'
import { proportionalResizeRect, selectionSnapSource } from '#vue/shared/input/resize/snap'
import { subtree } from '#vue/shared/input/sticky/scale'
import type { DragScale } from '#vue/shared/input/types'

const MIN_SCALE = 0.01

interface ScaleRoot {
  id: string
  /** The root's top-left in page coordinates when the drag began. */
  origin: { x: number; y: number }
  /** Maps a page point into the root's parent's coordinates. */
  toParent: Mat3
}

/** The selected layers that can scale, without those inside another selected layer. */
function scaleRoots(nodes: readonly SceneNode[], editor: Editor): SceneNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  return nodes.filter((node) => {
    if (!canRescaleNode(node) || isInsideInstance(node, editor.graph)) return false
    for (
      let parentId = node.parentId;
      parentId;
      parentId = editor.graph.getNode(parentId)?.parentId ?? null
    ) {
      if (ids.has(parentId)) return false
    }
    return true
  })
}

function rootInParent(node: SceneNode, editor: Editor): ScaleRoot {
  const parent = node.parentId ? editor.graph.getNode(node.parentId) : undefined
  return {
    id: node.id,
    origin: getAbsolutePosition(node, editor.graph),
    toParent: Matrix.invert(getParentWorldMatrix(parent, editor.graph)) ?? Matrix.identity()
  }
}

/**
 * Starts Figma's Scale drag from any handle of the selection. The box is the selection's bounds
 * in page coordinates; the roots are placed back into their own parents as they scale.
 */
export function tryStartScale(cx: number, cy: number, editor: Editor): DragScale | null {
  if (resolveEditorProfile(editor.state).layerEdits !== 'all') return null
  const selected = editor.getSelectedNodes().filter((node) => canRescaleNode(node))
  const roots = scaleRoots(selected, editor)
  if (roots.length === 0) return null

  const handle =
    roots.length === 1
      ? (getHitHandleByMatrix(
          cx,
          cy,
          roots[0],
          editor.graph,
          editor.renderer?.zoom,
          editor.state.rotationPreview
        )?.handle ?? null)
      : selectionResizeHandleAt(cx, cy, editor)
  if (!handle) return null

  const originals = new Map<string, SceneNode>()
  for (const root of roots) {
    for (const [id, node] of subtree(editor, root)) originals.set(id, node)
  }
  const origRect = computeBounds(roots.map((root) => getAxisAlignedWorldBounds(root, editor.graph)))
  const drag: DragScale = {
    type: 'scale',
    handle,
    startX: cx,
    startY: cy,
    origRect,
    roots: roots.map((root) => rootInParent(root, editor)),
    originals,
    scale: 1,
    rect: origRect,
    commit: () => commitScale(drag, editor),
    cancel: () => cancelScale(drag, editor)
  }
  return drag
}

/** Shows the selection scaled from the handle; only the commit records it. */
export function applyScale(drag: DragScale, cx: number, cy: number, editor: Editor) {
  const d = toRaw(drag)
  const { origRect } = d
  if (origRect.width === 0 || origRect.height === 0) return
  const aspect = origRect.width / origRect.height
  const ids = new Set(d.roots.map((root) => root.id))
  const source = selectionSnapSource(ids, editor.state.currentPageId)
  // Figma's Scale tool does not snap to layers; the box is always proportional.
  const rect = proportionalResizeRect(
    d.handle,
    origRect,
    cx - d.startX,
    cy - d.startY,
    aspect,
    source,
    editor,
    true
  )
  const scale = Math.max(MIN_SCALE, rect.width / origRect.width)
  d.scale = scale
  d.rect = rect
  const byId = new Map(d.roots.map((root) => [root.id, root]))
  for (const [id, original] of d.originals) {
    const root = byId.get(id)
    const changes = scaleNodeChanges(original, scale, root === undefined)
    if (root) {
      const world = {
        x: rect.x + (root.origin.x - origRect.x) * scale,
        y: rect.y + (root.origin.y - origRect.y) * scale
      }
      const [x, y] = Matrix.mapPoints(root.toParent, [world.x, world.y])
      changes.x = x
      changes.y = y
    }
    editor.graph.updateNodePreview(id, changes)
  }
  editor.requestRepaint()
}

function restoreScale(d: DragScale, editor: Editor) {
  const byId = new Set(d.roots.map((root) => root.id))
  for (const [id, original] of d.originals) {
    const changes = scaleNodeChanges(original, 1, !byId.has(id))
    if (byId.has(id)) Object.assign(changes, { x: original.x, y: original.y })
    editor.graph.updateNodePreview(id, changes)
  }
}

function commitScale(drag: DragScale, editor: Editor) {
  const d = toRaw(drag)
  restoreScale(d, editor)
  editor.setSnapGuides([])
  if (d.scale !== 1) {
    const nodes = d.roots.flatMap((root) => editor.graph.getNode(root.id) ?? [])
    editor.scaleSelected(nodes, d.scale, d.origRect, d.rect)
  }
  editor.requestRender()
}

function cancelScale(drag: DragScale, editor: Editor) {
  restoreScale(toRaw(drag), editor)
  editor.setSnapGuides([])
  editor.requestRender()
}
