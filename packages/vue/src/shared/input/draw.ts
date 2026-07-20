import { DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { Mat3 } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { TOOL_TO_NODE } from '#vue/shared/input/types'
import type { DragDraw, DragState } from '#vue/shared/input/types'

export function startTextDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  editor.undo.beginBatch('Create text')
  const nodeId = editor.createShape('TEXT', cx, cy, 0, 0)
  editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  setDrag({ type: 'draw', startX: cx, startY: cy, nodeId })
}

function worldToParentLocal(
  parentInverseMatrix: Mat3 | null,
  worldX: number,
  worldY: number
): Vector {
  if (!parentInverseMatrix) return { x: worldX, y: worldY }
  const [x, y] = Matrix.mapPoints(parentInverseMatrix, [worldX, worldY])
  return { x, y }
}

export function startShapeDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const nodeType = TOOL_TO_NODE[editor.state.activeTool]
  if (!nodeType) return

  const container = editor.graph.hitTestFrame(cx, cy, new Set(), editor.state.currentPageId)
  let parentId: string | undefined
  let parentInverseMatrix: Mat3 | null = null
  let shapeX = cx
  let shapeY = cy
  if (container?.type === 'FRAME') {
    parentId = container.id
    parentInverseMatrix = Matrix.invert(getWorldMatrix(container, editor.graph))
    const local = worldToParentLocal(parentInverseMatrix, cx, cy)
    shapeX = local.x
    shapeY = local.y
  }

  editor.undo.beginBatch('Create shape')
  const nodeId = editor.createShape(nodeType, shapeX, shapeY, 0, 0, parentId)
  editor.select([nodeId])
  setDrag({
    type: 'draw',
    startX: cx,
    startY: cy,
    nodeId,
    parentInverseMatrix
  })
}

export function handleDrawMove(
  d: DragDraw,
  cx: number,
  cy: number,
  shiftKey: boolean,
  editor: Editor
) {
  const start = worldToParentLocal(d.parentInverseMatrix, d.startX, d.startY)
  const cur = worldToParentLocal(d.parentInverseMatrix, cx, cy)

  let w = cur.x - start.x
  let h = cur.y - start.y

  if (shiftKey) {
    const size = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w) * size
    h = Math.sign(h) * size
  }

  editor.updateNode(d.nodeId, {
    x: w < 0 ? start.x + w : start.x,
    y: h < 0 ? start.y + h : start.y,
    width: Math.abs(w),
    height: Math.abs(h)
  })
}

export function handleDrawUp(d: DragDraw, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (node?.type === 'TEXT') {
    const isPointText = node.width < 2 && node.height < 2
    editor.updateNode(d.nodeId, {
      width: isPointText ? DEFAULT_TEXT_WIDTH : node.width,
      height: isPointText ? DEFAULT_TEXT_HEIGHT : node.height,
      textAutoResize: isPointText ? 'WIDTH_AND_HEIGHT' : 'NONE'
    })
  } else if (node && node.width < 2 && node.height < 2) {
    editor.updateNode(d.nodeId, { width: 100, height: 100 })
  }
  if (node?.type === 'SECTION') {
    editor.adoptNodesIntoSection(node.id)
  }
  const start = worldToParentLocal(d.parentInverseMatrix, d.startX, d.startY)
  editor.commitResize(d.nodeId, { x: start.x, y: start.y, width: 0, height: 0 })
  editor.undo.commitBatch()
  editor.setTool('SELECT')
  if (node?.type === 'TEXT') editor.startTextEditing(node.id)
}
