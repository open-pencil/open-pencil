import type { Ref } from 'vue'

import { computeGuideRedline, hitTestGuides } from '@open-pencil/core/canvas'
import { RULER_SIZE } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'

import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragGuide, DragState } from '#vue/shared/input/types'

interface GuideInputOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  editor: Editor
  canvasToLocal: (cx: number, cy: number, scopeId: string) => { lx: number; ly: number }
  setDrag: (drag: DragState) => void
  setCursor: (cursor: string | null) => void
}

export function selectedTopLevelGuideFrameId(editor: Editor): string | null {
  if (editor.state.selectedIds.size !== 1) return null
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  return node?.type === 'FRAME' && node.parentId === editor.state.currentPageId ? node.id : null
}

export function createGuideInput({
  canvasRef,
  editor,
  canvasToLocal,
  setDrag,
  setCursor
}: GuideInputOptions) {
  function viewport() {
    const canvas = canvasRef.value
    return {
      panX: editor.state.panX,
      panY: editor.state.panY,
      zoom: editor.state.zoom,
      width: canvas?.clientWidth ?? 0,
      height: canvas?.clientHeight ?? 0
    }
  }

  function hitTest(sx: number, sy: number) {
    return hitTestGuides(editor.graph, editor.state.currentPageId, viewport(), sx, sy)
  }

  function ownerAt(cx: number, cy: number): string {
    let node = editor.graph.hitTestDeep(cx, cy, editor.state.currentPageId)
    while (node) {
      if (node.type === 'FRAME' || node.type === 'COMPONENT') return node.id
      node = node.parentId ? (editor.graph.getNode(node.parentId) ?? null) : null
    }
    return editor.state.currentPageId
  }

  function positionFor(ownerId: string, axis: DragGuide['axis'], cx: number, cy: number) {
    const owner = editor.graph.getNode(ownerId)
    const local = owner && owner.type !== 'CANVAS' ? canvasToLocal(cx, cy, owner.id) : null
    return axis === 'x' ? (local?.lx ?? cx) : (local?.ly ?? cy)
  }

  function cursor(axis: DragGuide['axis']) {
    return axis === 'x' ? 'ew-resize' : 'ns-resize'
  }

  function rulerAxis(sx: number, sy: number): DragGuide['axis'] | null {
    if (sx < RULER_SIZE && sy < RULER_SIZE) return null
    if (sy < RULER_SIZE) return 'y'
    if (sx < RULER_SIZE) return 'x'
    return null
  }

  function updateHover(sx: number, sy: number): string | null {
    const axis = rulerAxis(sx, sy)
    if (axis) {
      editor.setHoveredGuide(null)
      return cursor(axis)
    }
    const hit = hitTest(sx, sy)
    editor.setHoveredGuide(hit ? { ownerId: hit.ownerId, guideId: hit.guideId } : null)
    return hit ? cursor(hit.axis) : null
  }

  function tryStartExisting(sx: number, sy: number, duplicate = false): boolean {
    if (rulerAxis(sx, sy)) return false
    const hit = hitTest(sx, sy)
    if (!hit) return false
    editor.setSelectedGuide({ ownerId: hit.ownerId, guideId: hit.guideId })
    editor.setHoveredGuide(null)
    setCursor(cursor(hit.axis))
    setDrag({
      type: 'guide',
      axis: hit.axis,
      ownerId: hit.ownerId,
      position: hit.position,
      startScreenX: sx,
      startScreenY: sy,
      currentScreenX: sx,
      currentScreenY: sy,
      dragStarted: false,
      guideId: hit.guideId,
      originalOwnerId: hit.ownerId,
      originalPosition: hit.position,
      duplicate
    })
    return true
  }

  function tryStartFromRuler(sx: number, sy: number, cx: number, cy: number): boolean {
    if (!('showRulers' in editor.state) || editor.state.showRulers !== true) return false
    const axis = rulerAxis(sx, sy)
    if (!axis) return false
    const ownerId = ownerAt(cx, cy)
    setDrag({
      type: 'guide',
      axis,
      ownerId,
      position: positionFor(ownerId, axis, cx, cy),
      startScreenX: sx,
      startScreenY: sy,
      currentScreenX: sx,
      currentScreenY: sy,
      dragStarted: false
    })
    return true
  }

  function handleMove(
    drag: DragGuide,
    sx: number,
    sy: number,
    cx: number,
    cy: number,
    redlines?: { frameId: string; deep: boolean }
  ): void {
    drag.currentScreenX = sx
    drag.currentScreenY = sy
    if (
      !drag.dragStarted &&
      !isPastPointerDragThreshold(drag.startScreenX, drag.startScreenY, sx, sy)
    )
      return
    drag.dragStarted = true
    setCursor(cursor(drag.axis))
    drag.ownerId = redlines?.frameId ?? ownerAt(cx, cy)
    drag.position = positionFor(drag.ownerId, drag.axis, cx, cy)
    editor.setGuidePreview({
      ownerId: drag.ownerId,
      axis: drag.axis,
      position: drag.position,
      source:
        !drag.duplicate && drag.guideId && drag.originalOwnerId
          ? { ownerId: drag.originalOwnerId, guideId: drag.guideId }
          : undefined
    })
    editor.setGuideRedline(
      redlines
        ? computeGuideRedline(
            editor.graph,
            editor.state.currentPageId,
            redlines.frameId,
            drag.axis,
            drag.position,
            redlines.deep
          )
        : null
    )
  }

  function finish(drag: DragGuide): void {
    if (drag.dragStarted) {
      if (drag.currentScreenX < RULER_SIZE || drag.currentScreenY < RULER_SIZE) {
        if (!drag.duplicate && drag.guideId && drag.originalOwnerId) {
          editor.removeGuide(drag.originalOwnerId, drag.guideId)
          editor.setSelectedGuide(null)
        }
      } else if (drag.duplicate && drag.guideId && drag.originalOwnerId) {
        const source = editor.graph
          .getNode(drag.originalOwnerId)
          ?.guides.find((guide) => guide.id === drag.guideId)
        if (source) {
          const guideId = editor.addGuide(drag.ownerId, drag.axis, drag.position)
          if (guideId) editor.setSelectedGuide({ ownerId: drag.ownerId, guideId })
        }
      } else if (drag.guideId && drag.originalOwnerId) {
        if (drag.ownerId === drag.originalOwnerId)
          editor.moveGuide(drag.ownerId, drag.guideId, drag.position)
        else editor.transferGuide(drag.originalOwnerId, drag.ownerId, drag.guideId, drag.position)
        editor.setSelectedGuide({ ownerId: drag.ownerId, guideId: drag.guideId })
      } else {
        const guideId = editor.addGuide(drag.ownerId, drag.axis, drag.position)
        if (guideId) editor.setSelectedGuide({ ownerId: drag.ownerId, guideId })
      }
    }
    clearHoverAndPreview()
  }

  function deleteSelected(event: KeyboardEvent): boolean {
    if (event.code !== 'Delete' && event.code !== 'Backspace') return false
    const selected = editor.state.guides.selected
    if (!selected || editor.state.editingTextId) return false
    if (!editor.removeGuide(selected.ownerId, selected.guideId)) return false
    editor.setSelectedGuide(null)
    event.preventDefault()
    return true
  }

  function clearHoverAndPreview(): void {
    editor.setGuidePreview(null)
    editor.setGuideRedline(null)
    editor.setHoveredGuide(null)
  }

  return {
    tryStartExisting,
    tryStartFromRuler,
    updateHover,
    handleMove,
    finish,
    deleteSelected,
    clearHoverAndPreview
  }
}
