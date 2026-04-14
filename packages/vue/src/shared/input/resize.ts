import { cloneVectorNetwork } from '@open-pencil/core'
import { getHitHandleByMatrix } from '@open-pencil/vue/shared/input/geometry'

import type { DragResize, HandlePosition } from './types'
import type { Rect, SceneNode } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core/editor'

export function constrainToAspectRatio(
  handle: HandlePosition,
  origRect: Rect,
  width: number,
  height: number,
  dx: number,
  dy: number
): Rect {
  let x = handle.includes('w') ? origRect.x + origRect.width - Math.abs(width) : origRect.x
  const isTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  let y = isTop ? origRect.y + origRect.height - Math.abs(height) : origRect.y
  const aspect = origRect.width / origRect.height

  if (handle === 'n' || handle === 's') {
    width = Math.abs(height) * aspect
    x = origRect.x + (origRect.width - width) / 2
  } else if (handle === 'e' || handle === 'w') {
    height = Math.abs(width) / aspect
    y = origRect.y + (origRect.height - height) / 2
  } else if (Math.abs(dx) > Math.abs(dy)) {
    height = (Math.abs(width) / aspect) * Math.sign(height || 1)
    if (isTop) y = origRect.y + origRect.height - Math.abs(height)
  } else {
    width = Math.abs(height) * aspect * Math.sign(width || 1)
    if (handle.includes('w')) x = origRect.x + origRect.width - Math.abs(width)
  }

  return { x, y, width, height }
}

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  const { handle, origRect } = d
  let { x, y, width, height } = origRect

  const dx = cx - d.startX
  const dy = cy - d.startY

  const origX = origRect.x
  const origY = origRect.y
  const origW = origRect.width
  const origH = origRect.height

  const moveLeft = handle.includes('w')
  const moveRight = handle.includes('e')
  const moveTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  const moveBottom = handle === 'sw' || handle === 's' || handle === 'se'

  if (moveRight) width = origW + dx
  if (moveLeft) {
    x = origX + dx
    width = origW - dx
  }
  if (moveBottom) height = origH + dy
  if (moveTop) {
    y = origY + dy
    height = origH - dy
  }

  if (constrain && origW > 0 && origH > 0) {
    ;({ x, y, width, height } = constrainToAspectRatio(handle, origRect, width, height, dx, dy))
  }

  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  const newW = Math.round(Math.max(1, width))
  const newH = Math.round(Math.max(1, height))
  const newX = Math.round(x)
  const newY = Math.round(y)

  const changes: Partial<SceneNode> = {
    x: newX,
    y: newY,
    width: newW,
    height: newH
  }

  if (d.origVectorNetwork && origW > 0 && origH > 0) {
    const sx = newW / origW
    const sy = newH / origH
    if (sx !== 1 || sy !== 1) {
      const vn = d.origVectorNetwork
      changes.vectorNetwork = {
        vertices: vn.vertices.map((v) => ({ ...v, x: v.x * sx, y: v.y * sy })),
        segments: vn.segments.map((s) => ({
          ...s,
          tangentStart: { x: s.tangentStart.x * sx, y: s.tangentStart.y * sy },
          tangentEnd: { x: s.tangentEnd.x * sx, y: s.tangentEnd.y * sy }
        })),
        regions: vn.regions
      }
    }
  }

  editor.updateNode(d.nodeId, changes)
}
export function tryStartResize(cx: number, cy: number, editor: Editor): DragResize | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node || node.locked) continue
    const handleResult = getHitHandleByMatrix(cx, cy, node, editor.graph, editor?.renderer?.zoom)
    if (handleResult?.handle) {
      return {
        type: 'resize',
        handle: handleResult?.handle,
        startX: cx,
        startY: cy,
        origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
        nodeId: id,
        origVectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null
      }
    }
  }
  return null
}
