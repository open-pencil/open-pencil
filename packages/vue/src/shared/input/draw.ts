import { TOOL_TO_NODE } from '#vue/shared/input/types'

import { DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'

import type { DragDraw, DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'

export function startTextTool(cx: number, cy: number, editor: Editor) {
  const nodeId = editor.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
  editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  editor.startTextEditing(nodeId)
  editor.setTool('SELECT')
  editor.requestRender()
}

export function startShapeDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const nodeType = TOOL_TO_NODE[editor.state.activeTool]
  if (!nodeType) return

  editor.undo.beginBatch('Create shape')
  const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
  editor.select([nodeId])
  setDrag({ type: 'draw', startX: cx, startY: cy, nodeId })
}

export function handleDrawMove(
  d: DragDraw,
  cx: number,
  cy: number,
  shiftKey: boolean,
  editor: Editor
) {
  let w = cx - d.startX
  let h = cy - d.startY

  if (shiftKey) {
    const size = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w) * size
    h = Math.sign(h) * size
  }

  editor.updateNode(d.nodeId, {
    x: w < 0 ? d.startX + w : d.startX,
    y: h < 0 ? d.startY + h : d.startY,
    width: Math.abs(w),
    height: Math.abs(h)
  })
}

export function handleDrawUp(d: DragDraw, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (node && node.width < 2 && node.height < 2) {
    editor.updateNode(d.nodeId, { width: 100, height: 100 })
  }
  if (node?.type === 'SECTION') {
    editor.adoptNodesIntoSection(node.id)
  }
  editor.commitResize(d.nodeId, { x: d.startX, y: d.startY, width: 0, height: 0 })
  editor.undo.commitBatch()
  editor.setTool('SELECT')
}
