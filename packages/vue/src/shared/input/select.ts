import type { SceneNode } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core/editor'

import type { DragState } from './types'
import {
  HANDLE_CURSORS,
  hitTestHandle,
  hitTestCornerRotation,
  cornerRotationCursor
} from './geometry'
import { tryStartResize } from './resize'
import { duplicateAndDrag, detectAutoLayoutParent } from './move'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

export function resolveHit(cx: number, cy: number, editor: Editor, fns: HitTestFns): SceneNode | null {
  const titleHit =
    fns.hitTestFrameTitle(cx, cy) ?? fns.hitTestSectionTitle(cx, cy) ?? fns.hitTestComponentLabel(cx, cy)
  if (titleHit) return titleHit

  const hit = fns.hitTestInScope(cx, cy, false)
  if (hit) return hit

  const scopeId = editor.state.enteredContainerId
  if (!scopeId) return null

  if (fns.isInsideContainerBounds(cx, cy, scopeId)) {
    editor.clearSelection()
    return null
  }

  editor.exitContainer()
  const afterExit = fns.hitTestInScope(cx, cy, false)
  if (afterExit) return afterExit

  if (editor.state.enteredContainerId) {
    editor.exitContainer()
  }
  return null
}

export function handleSelectDown(
  e: MouseEvent,
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (sx: number, sy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

  if (editor.state.editingTextId) editor.commitTextEdit()

  if (tryStartRotation(sx, sy)) return

  const resizeDrag = tryStartResize(sx, sy, cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return
  }

  const hit = resolveHit(cx, cy, editor, fns)
  if (!hit) {
    if (!editor.state.enteredContainerId) {
      editor.clearSelection()
      setDrag({ type: 'marquee', startX: cx, startY: cy })
    }
    return
  }

  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  const allLocked = [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
  if (allLocked) return

  const originals = new Map<string, { x: number; y: number; parentId: string }>()
  for (const id of editor.state.selectedIds) {
    const n = editor.graph.getNode(id)
    if (n)
      originals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? editor.state.currentPageId })
  }

  if (e.altKey && editor.state.selectedIds.size > 0) {
    const result = duplicateAndDrag(cx, cy, editor)
    setDrag(result.drag)
    return
  }

  setDrag({
    type: 'move',
    startX: cx,
    startY: cy,
    originals,
    autoLayoutParentId: detectAutoLayoutParent(editor)
  })
}

export function updateHoverCursor(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>
): string | null {
  let cursor: string | null = null

  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    const abs = editor.graph.getAbsolutePosition(id)
    const handle = hitTestHandle(
      sx,
      sy,
      abs.x,
      abs.y,
      node.width,
      node.height,
      editor.state.zoom,
      editor.state.panX,
      editor.state.panY,
      node.rotation
    )
    if (handle) {
      cursor = HANDLE_CURSORS[handle]
      break
    }
  }

  if (!cursor && editor.state.selectedIds.size === 1) {
    const id = [...editor.state.selectedIds][0]
    const node = editor.graph.getNode(id)
    if (node) {
      const abs = editor.graph.getAbsolutePosition(id)
      const corner = hitTestCornerRotation(
        sx,
        sy,
        abs.x,
        abs.y,
        node.width,
        node.height,
        editor.state.zoom,
        editor.state.panX,
        editor.state.panY,
        node.rotation
      )
      if (corner) {
        cursor = cornerRotationCursor(corner, node.rotation)
      }
    }
  }

  const hit =
    fns.hitTestSectionTitle(cx, cy) ?? fns.hitTestComponentLabel(cx, cy) ?? fns.hitTestInScope(cx, cy, false)
  editor.setHoveredNode(hit && !editor.state.selectedIds.has(hit.id) ? hit.id : null)

  return cursor
}
