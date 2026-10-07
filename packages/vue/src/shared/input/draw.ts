import { DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { NodeType, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { findDrawParent } from '#vue/shared/input/drop-target'
import { TOOL_TO_NODE } from '#vue/shared/input/types'
import type { DragDraw, DragState } from '#vue/shared/input/types'

/** Maps canvas points into the axes of the parent a layer is drawn in. */
function parentSpace(editor: Editor, parentId: string): DragDraw['toLocal'] {
  const parent = editor.graph.getNode(parentId)
  if (!parent || parent.type === 'CANVAS') return (x, y) => ({ x, y })
  const toLocal = Matrix.invert(getWorldMatrix(parent, editor.graph)) ?? Matrix.identity()
  return (x, y) => {
    const [lx, ly] = Matrix.mapPoints(toLocal, [x, y])
    return { x: lx, y: ly }
  }
}

function startDraw(
  type: NodeType,
  label: string,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  editor.undo.beginBatch(label)
  const parentId = findDrawParent(cx, cy, type, editor)
  const toLocal = parentSpace(editor, parentId)
  const start = toLocal(cx, cy)
  const nodeId = editor.createShape(type, start.x, start.y, 0, 0, parentId)
  if (type === 'TEXT') editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  setDrag(createDraw(editor, nodeId, start.x, start.y, toLocal, type === 'LINE'))
}

export function startTextDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  startDraw('TEXT', 'Create text', cx, cy, editor, setDrag)
}

export function startShapeDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const nodeType = TOOL_TO_NODE[editor.state.activeTool]
  if (!nodeType) return

  startDraw(nodeType, 'Create shape', cx, cy, editor, setDrag)
}

const LINE_ANGLE_STEP = 45

/** A line from the start point to the cursor: its length, no height, and the angle as rotation. */
function lineGeometry(d: DragDraw, dx: number, dy: number, shiftKey: boolean): Partial<SceneNode> {
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  // Shift snaps the angle to steps of 45°.
  if (shiftKey) angle = Math.round(angle / LINE_ANGLE_STEP) * LINE_ANGLE_STEP
  return { x: d.startX, y: d.startY, width: Math.hypot(dx, dy), height: 0, rotation: angle }
}

export function handleDrawMove(d: DragDraw, cx: number, cy: number, shiftKey: boolean) {
  const point = d.toLocal(cx, cy)
  let w = point.x - d.startX
  let h = point.y - d.startY
  if (d.line) {
    d.update(lineGeometry(d, w, h, shiftKey))
    return
  }

  if (shiftKey) {
    const size = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w) * size
    h = Math.sign(h) * size
  }

  d.update({
    x: w < 0 ? d.startX + w : d.startX,
    y: h < 0 ? d.startY + h : d.startY,
    width: Math.abs(w),
    height: Math.abs(h)
  })
}

/** Gives a layer made by a click its default size; returns whether it was only clicked. */
function settleDrawnSize(preview: ReturnType<Editor['beginNodePreview']>, node: SceneNode) {
  const clicked = node.width < 2 && node.height < 2
  if (node.type === 'TEXT') {
    preview.update(node.id, {
      width: clicked ? DEFAULT_TEXT_WIDTH : node.width,
      height: clicked ? DEFAULT_TEXT_HEIGHT : node.height,
      textAutoResize: clicked ? 'WIDTH_AND_HEIGHT' : 'NONE'
    })
  } else if (node.type === 'LINE' && node.width < 2) {
    preview.update(node.id, { width: 100, height: 0, rotation: 0 })
    return true
  } else if (clicked) {
    preview.update(node.id, { width: 100, height: 100 })
  }
  return clicked
}

function createDraw(
  editor: Editor,
  nodeId: string,
  startX: number,
  startY: number,
  toLocal: DragDraw['toLocal'],
  line: boolean
): DragDraw {
  const graph = editor.graph
  const preview = editor.beginNodePreview('Draw dimensions')
  let finished = false

  function cancel() {
    if (finished) return
    finished = true
    preview.cancel()
    // Never replay an old document's creation undo against a replacement graph.
    if (editor.graph === graph) editor.undo.rollbackBatch()
  }

  function commit() {
    if (finished) return
    if (preview.closed || editor.graph !== graph) {
      cancel()
      return
    }
    finished = true
    const node = graph.getNode(nodeId)
    try {
      const clicked = node ? settleDrawnSize(preview, node) : false
      preview.commit()
      // Drawn into auto layout, the layer joins the flow at the end.
      const parent = graph.getNode(node?.parentId ?? '')
      if (parent && parent.layoutMode !== 'NONE') editor.runLayoutForNode(parent.id)
      // A frame made by a click, not drawn over anything, takes nothing in.
      if (node?.type === 'SECTION' || (node?.type === 'FRAME' && !clicked)) {
        editor.adoptCoveredLayers(node.id)
      }
      editor.undo.commitBatch()
    } catch (error) {
      preview.cancel()
      editor.undo.rollbackBatch()
      throw error
    }
    editor.setTool('SELECT')
    if (node?.type === 'TEXT') editor.startTextEditing(node.id)
  }

  // Creation itself is already an edit: avoid rebuilding the backing on the first held frame.
  try {
    preview.update(nodeId, { x: startX, y: startY })
  } catch (error) {
    cancel()
    throw error
  }

  return {
    type: 'draw',
    startX,
    startY,
    toLocal,
    line,
    nodeId,
    update: (changes) => {
      if (!finished) preview.update(nodeId, changes)
    },
    commit,
    cancel
  }
}
