import { getNodeEditCapability, resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { generatedFrameOwner, generatedFrameText } from '@open-pencil/scene-graph/generated'

import type { CanvasLabelKind } from '#vue/canvas/labels/edit'
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
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
  getClickCount: () => number
  wasSelectedBeforeClickSequence: (id: string) => boolean
  onEditCanvasLabel?: (kind: CanvasLabelKind, node: SceneNode) => void
  setDrag: SetDrag
}

export function createTextEditInput(options: TextEditInputOptions) {
  const {
    editor,
    getCoords,
    hitTestInScope,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle,
    getClickCount,
    wasSelectedBeforeClickSequence,
    onEditCanvasLabel,
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
      const hit = hitTestInScope(cx, cy, true)
      if (hit?.type === 'TEXT' && hit.id !== editNode.id) {
        startTextEditingAt(hit, cx, cy)
        return true
      }
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
    editor.textSelectionChanged()
    return true
  }

  function startTextEditingAt(hit: SceneNode, cx: number, cy: number) {
    editor.select([hit.id])
    editor.startTextEditing(hit.id)
    // Text the editor refuses, such as path text without its font, stays selected only.
    if (editor.state.editingTextId !== hit.id) return
    const textEd = editor.textEditor
    if (textEd) {
      const abs = editor.graph.getAbsolutePosition(hit.id)
      textEd.selectWordAt(cx - abs.x, cy - abs.y)
      editor.textSelectionChanged()
    }
  }

  /** Edits a sticky note's body or a connector's label with all of it selected, as FigJam does. */
  function startGeneratedTextEditing(frame: SceneNode) {
    const body = generatedFrameText(editor.graph, frame)
    if (!body) return
    editor.select([frame.id])
    editor.startTextEditing(body.id)
    if (editor.state.editingTextId !== body.id) return
    editor.textEditor?.selectAll()
    editor.textSelectionChanged()
  }

  function getContainerDescendantHit(
    containerId: string,
    cx: number,
    cy: number
  ): SceneNode | null {
    // Double-clicking goes one level into the container, as in Figma.
    const hit = editor.graph.hitTestSelectable(cx, cy, containerId, new Set())
    if (hit) return hit
    return editor.graph.isPointInNode(containerId, cx, cy)
      ? (editor.graph.getNode(containerId) ?? null)
      : null
  }

  /**
   * Double-clicking the name above a section, frame or component renames it in place and keeps
   * it selected, as in Figma. A locked layer or a library's read-only component keeps its name.
   */
  function startLabelRename(cx: number, cy: number): boolean {
    const labels: [CanvasLabelKind, SceneNode | null][] = [
      ['section-title', hitTestSectionTitle(cx, cy)],
      ['component-label', hitTestComponentLabel(cx, cy)],
      ['frame-title', hitTestFrameTitle(cx, cy)]
    ]
    for (const [kind, node] of labels) {
      if (!node) continue
      editor.select([node.id])
      if (!node.locked && getNodeEditCapability(editor.graph, node.id).editable)
        onEditCanvasLabel?.(kind, node)
      return true
    }
    return false
  }

  function handleContainerDoubleClick(
    selectedId: string | undefined,
    cx: number,
    cy: number
  ): boolean {
    const selectedNode = selectedId ? editor.graph.getNode(selectedId) : undefined
    if (
      !selectedNode ||
      !selectedId ||
      !editor.graph.isContainer(selectedId) ||
      selectedNode.locked
    ) {
      return false
    }
    const hit = getContainerDescendantHit(selectedId, cx, cy)
    editor.enterContainer(selectedId)
    if (hit?.type === 'TEXT' && resolveEditorProfile(editor.state).edits)
      startTextEditingAt(hit, cx, cy)
    else if (hit) editor.select([hit.id])
    else editor.clearSelection()
    return true
  }

  function onDblClick(e: MouseEvent) {
    const nodeEditEditor = editor as Editor & NodeEditMethods
    if (editor.state.editingTextId) return

    const { cx, cy } = getCoords(e)
    const readOnly = !resolveEditorProfile(editor.state).edits
    if (!readOnly && startLabelRename(cx, cy)) return

    const selectedId =
      editor.state.selectedIds.size === 1 ? [...editor.state.selectedIds][0] : undefined
    if (handleContainerDoubleClick(selectedId, cx, cy)) return

    const found = hitTestInScope(cx, cy, true)
    if (!found) return
    // A generated frame's sublayers are edited through the frame.
    const hit = generatedFrameOwner(editor.graph, found) ?? found
    // A read-only document selects what a double-click would edit, as Figma does.
    if (readOnly) {
      editor.select([hit.id])
      return
    }

    if (hit.type === 'TEXT') {
      const isTopLevelText = hit.parentId === editor.state.currentPageId
      if (!isTopLevelText && selectedId !== hit.id && !wasSelectedBeforeClickSequence(hit.id)) {
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

    if (generatedFrameText(editor.graph, hit)) {
      startGeneratedTextEditing(hit)
      return
    }

    editor.select([hit.id])
  }

  return { handleTextEditClick, onDblClick }
}
