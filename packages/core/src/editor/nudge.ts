import { isEqual } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { collectNodePositions, pushPositionUndo } from './history/position'
import { fitEnclosingGroupsWithUndo } from './structure/group-bounds'
import type { EditorContext } from './types'

const NUDGE_COMMIT_DELAY = 300

/** The flow an arrow key moves a layer along: its row or column, or none. */
function flowParent(ctx: EditorContext, node: SceneNode): SceneNode | null {
  if (node.layoutPositioning === 'ABSOLUTE' || !node.parentId) return null
  const parent = ctx.graph.getNode(node.parentId)
  return parent?.layoutMode === 'HORIZONTAL' || parent?.layoutMode === 'VERTICAL' ? parent : null
}

/**
 * One slot along the flow for an arrow key, as Figma reorders auto layout children: Right and
 * Left in a row (mirrored when it runs right to left), Down and Up in a column, and nothing for
 * the arrows across it. Shift moves one slot too.
 */
function flowStep(parent: SceneNode, dx: number, dy: number): -1 | 0 | 1 {
  const along = parent.layoutMode === 'HORIZONTAL' ? dx : dy
  const visual =
    parent.layoutMode === 'HORIZONTAL' && parent.layoutDirection === 'RTL' ? -along : along
  if (visual === 0) return 0
  return visual > 0 ? 1 : -1
}

/**
 * The flow with each selected layer moved one slot by `step`; one already at the end of the
 * flow, or behind another selected layer that is, stays put.
 */
function steppedFlow(
  flow: readonly string[],
  selected: ReadonlySet<string>,
  step: 1 | -1
): string[] {
  const order = [...flow]
  const indices = step > 0 ? order.map((_, i) => order.length - 1 - i) : order.map((_, i) => i)
  for (const i of indices) {
    const j = i + step
    if (!selected.has(order[i]) || j < 0 || j >= order.length || selected.has(order[j])) continue
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function createNudgeActions(ctx: EditorContext) {
  let nudgeOriginals: Map<string, Vector> | null = null
  let reorderOriginals: Map<string, string[]> | null = null
  let nudgeCommitTimer: ReturnType<typeof setTimeout> | null = null

  function applyOrder(parentId: string, order: readonly string[]) {
    order.forEach((id, index) => ctx.graph.reorderChild(id, parentId, index))
    ctx.runLayoutForNode(parentId)
  }

  function commitReorder() {
    if (!reorderOriginals) return
    const originals = reorderOriginals
    reorderOriginals = null
    const finals = new Map(
      [...originals.keys()].map((id) => [id, [...(ctx.graph.getNode(id)?.childIds ?? [])]])
    )
    if ([...originals].every(([id, order]) => isEqual(order, finals.get(id)))) return
    ctx.undo.push({
      label: 'Reorder',
      forward: () => {
        for (const [id, order] of finals) applyOrder(id, order)
      },
      inverse: () => {
        for (const [id, order] of originals) applyOrder(id, order)
      }
    })
  }

  function commitNudge() {
    nudgeCommitTimer = null
    commitReorder()
    if (!nudgeOriginals) return
    const originals = nudgeOriginals
    nudgeOriginals = null

    const finals = collectNodePositions(ctx, originals.keys())
    const parentIds = [...originals.keys()].flatMap((id) => ctx.graph.getNode(id)?.parentId ?? [])
    // Groups and booleans fit their nudged children, in the same undo step.
    ctx.undo.runBatch('Nudge', () => {
      pushPositionUndo(ctx, 'Nudge', originals, finals)
      fitEnclosingGroupsWithUndo(ctx, parentIds)
    })
    ctx.requestRender()
  }

  /** Moves the selected layers in auto layout flows one slot; returns the layers it handled. */
  function reorderInFlows(movable: readonly string[], dx: number, dy: number): Set<string> {
    const byParent = new Map<string, Set<string>>()
    for (const id of movable) {
      const node = ctx.graph.getNode(id)
      const parent = node && flowParent(ctx, node)
      if (!parent) continue
      const selected = byParent.get(parent.id) ?? new Set<string>()
      selected.add(id)
      byParent.set(parent.id, selected)
    }
    const handled = new Set<string>()
    for (const [parentId, selected] of byParent) {
      for (const id of selected) handled.add(id)
      const parent = ctx.graph.getNode(parentId)
      const step = parent ? flowStep(parent, dx, dy) : 0
      if (!parent || step === 0) continue
      const children = ctx.graph.getChildren(parentId)
      const flowIds = children
        .filter((child) => child.layoutPositioning !== 'ABSOLUTE')
        .map((c) => c.id)
      const moved = steppedFlow(flowIds, selected, step)
      if (isEqual(moved, flowIds)) continue
      reorderOriginals ??= new Map()
      if (!reorderOriginals.has(parentId)) reorderOriginals.set(parentId, [...parent.childIds])
      // Layers that ignore the layout keep their places in the stack.
      let next = 0
      const order = children.map((child) =>
        child.layoutPositioning === 'ABSOLUTE' ? child.id : moved[next++]
      )
      applyOrder(parentId, order)
    }
    return handled
  }

  function nudgeSelected(dx: number, dy: number) {
    const ids = [...ctx.state.selectedIds]
    if (ids.length === 0) return

    const movable: string[] = []
    for (const id of ids) {
      const node = ctx.graph.getNode(id)
      if (node && !node.locked) movable.push(id)
    }
    if (movable.length === 0) return

    const reordered = reorderInFlows(movable, dx, dy)
    const nudged = movable.filter((id) => !reordered.has(id))

    if (nudged.length > 0 && !nudgeOriginals) {
      nudgeOriginals = new Map()
      for (const id of nudged) {
        const node = ctx.graph.getNode(id)
        if (node) nudgeOriginals.set(id, { x: node.x, y: node.y })
      }
    }

    for (const id of nudged) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      ctx.graph.updateNode(id, { x: node.x + dx, y: node.y + dy })
      ctx.runLayoutForNode(id)
    }

    if (nudgeCommitTimer) clearTimeout(nudgeCommitTimer)
    nudgeCommitTimer = setTimeout(commitNudge, NUDGE_COMMIT_DELAY)

    ctx.requestRender()
  }

  function flushNudge() {
    if (nudgeCommitTimer) {
      clearTimeout(nudgeCommitTimer)
      commitNudge()
    }
  }

  return { nudgeSelected, flushNudge }
}
