import type { Editor, MovePlace } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text-direction'

/**
 * Layers dragged along their own auto layout flow, as one block: the selected layers of one
 * frame in their order, the other layers in its flow, and the slot the block starts in, the
 * number of other layers before the first selected one.
 */
export interface FlowDrag {
  parentId: string
  ids: string[]
  others: string[]
  start: number
}

function layoutDirection(node: SceneNode, editor: Editor): 'LTR' | 'RTL' {
  const parent = node.parentId ? editor.graph.getNode(node.parentId) : null
  return resolveNodeLayoutDirection(node, parent ? layoutDirection(parent, editor) : 'LTR')
}

function inFlow(child: SceneNode) {
  return child.visible && child.layoutPositioning !== 'ABSOLUTE'
}

/**
 * The flows a move drags along, or undefined when a moved layer is not in a row or column that
 * does not wrap, which keeps the cursor-based reorder.
 */
export function collectFlowDrags(
  originals: ReadonlyMap<string, MovePlace>,
  editor: Editor
): FlowDrag[] | undefined {
  const byParent = new Map<string, Set<string>>()
  for (const [id, original] of originals) {
    const node = editor.graph.getNode(id)
    const parent = editor.graph.getNode(original.parentId)
    if (!node || !parent || !inFlow(node)) return undefined
    if (parent.layoutMode !== 'HORIZONTAL' && parent.layoutMode !== 'VERTICAL') return undefined
    if (parent.layoutWrap === 'WRAP') return undefined
    const ids = byParent.get(parent.id) ?? new Set<string>()
    ids.add(id)
    byParent.set(parent.id, ids)
  }
  return [...byParent].map(([parentId, selected]) => {
    const children = editor.graph.getChildren(parentId)
    const flow = children.filter(inFlow)
    const others = flow.filter((child) => !selected.has(child.id)).map((child) => child.id)
    const first = flow.findIndex((child) => selected.has(child.id))
    return {
      parentId,
      ids: children.filter((child) => selected.has(child.id)).map((child) => child.id),
      others,
      start: flow.slice(0, first).filter((child) => !selected.has(child.id)).length
    }
  })
}

/**
 * The slot among the other layers the block is in after a drag of `dx`, `dy`, as Figma reorders
 * auto layout children while they are dragged: the block passes the next layer once its leading
 * edge reaches that layer's centre, laid out with the block in the slot it has reached. That is
 * a gap and half the layer past the layers it has passed, so the slot follows the drag along the
 * flow, wherever the layer was grabbed.
 */
export function flowSlot(flow: FlowDrag, dx: number, dy: number, editor: Editor): number {
  const parent = editor.graph.getNode(flow.parentId)
  if (!parent) return flow.start
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const along = isRow ? dx : dy
  const delta = isRow && layoutDirection(parent, editor) === 'RTL' ? -along : along
  const sizes = flow.others.map((id) => {
    const node = editor.graph.getNode(id)
    return node ? (isRow ? node.width : node.height) : 0
  })
  const gap = parent.itemSpacing
  let slot = flow.start
  let passed = 0
  if (delta > 0) {
    while (slot < sizes.length && delta > passed + gap + sizes[slot] / 2) {
      passed += sizes[slot] + gap
      slot++
    }
  } else {
    while (slot > 0 && -delta > passed + gap + sizes[slot - 1] / 2) {
      passed += sizes[slot - 1] + gap
      slot--
    }
  }
  return slot
}

/**
 * The frame's children with the block in `slot`: the other children keep their order, layers
 * that ignore the layout or are hidden included, and the block goes before the other layer in
 * that slot.
 */
export function flowOrder(flow: FlowDrag, slot: number, editor: Editor): string[] {
  const parent = editor.graph.getNode(flow.parentId)
  if (!parent) return []
  const selected = new Set(flow.ids)
  const rest = parent.childIds.filter((id) => !selected.has(id))
  const before = flow.others.at(slot)
  const last = flow.others.at(-1)
  let at = rest.length
  if (before !== undefined) at = rest.indexOf(before)
  else if (last !== undefined) at = rest.indexOf(last) + 1
  return [...rest.slice(0, at), ...flow.ids, ...rest.slice(at)]
}

/** The selected layers' box along both axes, in canvas units, moved by `dx`, `dy`. */
export function flowBlockBounds(flow: FlowDrag, dx: number, dy: number, editor: Editor) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const id of flow.ids) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    const abs = editor.graph.getAbsolutePosition(id)
    left = Math.min(left, abs.x + dx)
    top = Math.min(top, abs.y + dy)
    right = Math.max(right, abs.x + dx + node.width)
    bottom = Math.max(bottom, abs.y + dy + node.height)
  }
  return { left, top, right, bottom }
}
