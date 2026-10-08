import type { Canvas } from 'canvaskit-wasm'

import { instanceSlotFrames, slotPropertyId } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { SLOT_EMPTY_FILL_ALPHA } from '#core/constants'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

import { inNodeSpace, withScreenStroke } from './outline'

const SLOT_DASH = 4

/**
 * Slots worth outlining for these nodes: every slot of a component or instance, and the slot
 * a layer sits in. Figma outlines them in pink so content can be placed without hunting.
 */
function focusedSlots(graph: SceneGraph, ids: Iterable<string>): Map<string, SceneNode> {
  const slots = new Map<string, SceneNode>()
  for (const id of ids) {
    const node = graph.getNode(id)
    if (!node) continue
    if (node.type === 'INSTANCE' || node.type === 'COMPONENT')
      for (const frame of instanceSlotFrames(graph, node)) slots.set(frame.id, frame)
    let ancestor = node.parentId ? graph.getNode(node.parentId) : undefined
    while (ancestor && ancestor.type !== 'CANVAS') {
      if (slotPropertyId(ancestor)) {
        slots.set(ancestor.id, ancestor)
        break
      }
      if (ancestor.type === 'INSTANCE' || ancestor.type === 'COMPONENT') break
      ancestor = ancestor.parentId ? graph.getNode(ancestor.parentId) : undefined
    }
  }
  return slots
}

/** Dashed pink outlines around the slots of the hovered and selected layers; empty slots tinted. */
export function drawSlotOutlines(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  hoveredNodeId?: string | null,
  preview?: RotationPreview | null
): void {
  const ids = hoveredNodeId ? [...selectedIds, hoveredNodeId] : selectedIds
  const slots = focusedSlots(graph, ids)
  for (const id of selectedIds) slots.delete(id)
  if (hoveredNodeId) slots.delete(hoveredNodeId)
  if (slots.size === 0) return

  const geometry = createSceneGeometry(graph, preview)
  r.auxFill.setColor(r.slotColor(SLOT_EMPTY_FILL_ALPHA))
  withScreenStroke(r, { color: r.slotColor(), dash: [SLOT_DASH, SLOT_DASH] }, (paint) => {
    for (const frame of slots.values()) {
      inNodeSpace(r, canvas, geometry, frame, () => {
        const rect = r.ck.LTRBRect(0, 0, frame.width, frame.height)
        if (frame.childIds.length === 0) canvas.drawRect(rect, r.auxFill)
        canvas.drawRect(rect, paint)
      })
    }
  })
}
