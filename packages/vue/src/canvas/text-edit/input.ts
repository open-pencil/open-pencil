import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

import type { DragState } from '#vue/shared/input/types'

type NodeEditMethods = Partial<{ enterNodeEditMode: (nodeId: string) => void }>
type GetCoords = (e: MouseEvent) => { cx: number; cy: number }
type HitTest = (cx: number, cy: number, deep: boolean) => SceneNode | null
type SetDrag = (drag: DragState) => void

type TextEditInputOptions = {
  editor: Editor
  getCoords: GetCoords
  hitTestInScope: HitTest
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  getClickCount: () => number
  wasSelectedBeforeClickSequence: (id: string) => boolean
  setDrag: SetDrag
}

export function createTextEditInput(options: TextEditInputOptions) {
  const {
    editor,
    getCoords,
    hitTestInScope,
    hitTestSectionTitle,
    hitTestComponentLabel,
    getClickCount,
    wasSelectedBeforeClickSequence,
    setDrag
  } = options

  function handleTextEditClick(cx: number, cy: number, shiftKey: boolean): boolean {
    const textEd = editor.textEditor
    const editNode = editor.state.editingTextId
      ? editor.graph.getNode(editor.state.editingTextId)
      : null
    if (!textEd || !editNode) {
      editor.commitTextEdit()
      return false
    }
    const abs = editor.graph.getAbsolutePosition(editNode.id)
    const localX = cx - abs.x
    const localY = cy - abs.y
    if (localX < 0 || localY < 0 || localX > editNode.width || localY > editNode.height) {
      editor.commitTextEdit()
      return false
    }
    if (getClickCount() >= 3) {
      textEd.selectAll()
    } else if (getClickCount() === 2) {
      textEd.selectWordAt(localX, localY)
    } else {
      textEd.setCursorAt(localX, localY, shiftKey)
      setDrag({ type: 'text-select', startX: cx, startY: cy })
    }
    editor.requestRender()
    return true
  }

  function startTextEditingAt(hit: SceneNode, cx: number, cy: number) {
    editor.select([hit.id])
    editor.startTextEditing(hit.id)
    const textEd = editor.textEditor
    if (textEd) {
      const abs = editor.graph.getAbsolutePosition(hit.id)
      textEd.selectWordAt(cx - abs.x, cy - abs.y)
      editor.requestRender()
    }
  }

  function getContainerDescendantHit(
    containerId: string,
    cx: number,
    cy: number
  ): SceneNode | null {
    const hit = editor.graph.hitTestDeep(cx, cy, editor.state.currentPageId)
    if (!hit) return null
    if (hit.id === containerId || editor.graph.isDescendant(hit.id, containerId)) return hit
    return null
  }

  function onDblClick(e: MouseEvent) {
    const nodeEditEditor = editor as Editor & NodeEditMethods
    if (editor.state.editingTextId) return

    const { cx, cy } = getCoords(e)

    const selectedId =
      editor.state.selectedIds.size === 1 ? [...editor.state.selectedIds][0] : undefined
    const selectedNode = selectedId ? editor.graph.getNode(selectedId) : undefined
    const canEnter =
      selectedNode && selectedId && editor.graph.isContainer(selectedId) && !selectedNode.locked

    if (canEnter) {
      const useDeep = selectedNode.type === 'COMPONENT' || selectedNode.type === 'INSTANCE'
      const hit = useDeep
        ? getContainerDescendantHit(selectedId, cx, cy)
        : hitTestInScope(cx, cy, false)
      editor.enterContainer(selectedId)
      if (hit) {
        editor.select([hit.id])
      } else {
        editor.clearSelection()
      }
      return
    }

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, true)
    if (!hit) return

    if (hit.type === 'TEXT') {
      const isTopLevelText = hit.parentId === editor.state.currentPageId
      if (!isTopLevelText && !wasSelectedBeforeClickSequence(hit.id)) {
        editor.select([hit.id])
        return
      }
      startTextEditingAt(hit, cx, cy)
      return
    }

    if (hit.type === 'VECTOR') {
      nodeEditEditor.enterNodeEditMode?.(hit.id)
      return
    }

    editor.select([hit.id])
  }

  return { handleTextEditClick, onDblClick }
}
