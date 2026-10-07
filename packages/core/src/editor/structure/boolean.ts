import {
  fitEnclosingGroups,
  undoGroupFit,
  type GroupFit,
  type GroupFitOptions,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { canMakeBooleanSourceNode, groupFitOptions } from '#core/canvas/boolean'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import { newLayerDefaults } from '#core/editor/shapes/defaults'
import type { EditorContext } from '#core/editor/types'

import { canvasWrapIndex, inStackOrder, wrapNodes } from './container-wrap'
import { selectedNodesInSharedParent } from './selection'

export type BooleanOperation = 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE'

/**
 * Wraps sibling layers in a boolean operation named after it, as Figma names one from the canvas
 * and from the plugin API. Shared by the editor command and the plugin API; `props` gives the look.
 * Returns the refit of the boolean and the groups around it too, so undo can reverse it.
 */
export function createBooleanOperation(
  graph: SceneGraph,
  nodes: readonly SceneNode[],
  parentId: string,
  operation: BooleanOperation,
  index: number | undefined,
  props: Partial<SceneNode> = {},
  fitOptions: GroupFitOptions = {}
): { node: SceneNode; fit: GroupFit | null } {
  const node = wrapNodes(graph, 'BOOLEAN_OPERATION', nodes, parentId, index, {
    name: operationLabel(operation),
    booleanOperation: operation,
    ...props
  })
  // Figma sizes a boolean to its result, and the groups around it follow.
  const fit = fitEnclosingGroups(graph, [node.id], fitOptions)
  return { node, fit }
}

/**
 * Paints of a new boolean operation, listed bottom to top. From the canvas Figma fills it like its
 * topmost operand, or like the base for Subtract, without strokes; from the plugin API it gets the
 * default shape grey.
 */
export function booleanOperationPaints(
  operation: BooleanOperation,
  nodes: readonly SceneNode[],
  style: 'canvas' | 'script'
): Partial<SceneNode> {
  if (style === 'script') return { fills: newLayerDefaults('RECTANGLE').fills, strokes: [] }
  const source = operation === 'SUBTRACT' ? nodes.at(0) : nodes.at(-1)
  return { fills: copyFills(source?.fills ?? []), strokes: [] }
}

export function booleanOperationSelected(
  ctx: EditorContext,
  selectedNodes: SceneNode[],
  operation: BooleanOperation
) {
  const selection = selectedNodesInSharedParent(ctx, selectedNodes)
  if (!selection || selection.topLevel.length < 2) return null
  const { parentId, parent } = selection
  if (selection.topLevel.some((node) => !canMakeBooleanSourceNode(node, ctx.graph))) return null

  const operands = inStackOrder(ctx.graph, selection.topLevel, parentId)
  const prevSelection = new Set(ctx.state.selectedIds)
  const childSnapshots = operands.map((node) => ({
    id: node.id,
    subtree: snapshotSubtree(ctx.graph, node.id)
  }))
  const origPositions = operands.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    index: parent.childIds.indexOf(node.id)
  }))
  const index = canvasWrapIndex(parent, operands)
  const { node: booleanNode, fit: createdFit } = createBooleanOperation(
    ctx.graph,
    operands,
    parentId,
    operation,
    index,
    booleanOperationPaints(operation, operands, 'canvas'),
    groupFitOptions(ctx.getRenderer(), ctx.graph)
  )
  const booleanId = booleanNode.id
  let fit = createdFit
  ctx.setSelectedIds(new Set([booleanId]))

  ctx.undo.push({
    label: operationLabel(operation),
    forward: () => {
      const nodes = origPositions.flatMap((pos) => ctx.graph.getNode(pos.id) ?? [])
      fit = createBooleanOperation(
        ctx.graph,
        nodes,
        parentId,
        operation,
        index,
        { ...booleanNode, childIds: [], id: booleanId },
        groupFitOptions(ctx.getRenderer(), ctx.graph)
      ).fit
      ctx.setSelectedIds(new Set([booleanId]))
    },
    inverse: () => {
      // The groups around the boolean go back first, so the operands' places mean what they did.
      if (fit) undoGroupFit(ctx.graph, fit)
      for (const { id, subtree } of childSnapshots) {
        const root = subtree.get(id)
        if (!root) continue
        if (!ctx.graph.getNode(id)) restoreSubtree(ctx.graph, root, parentId, subtree)
        else ctx.graph.reparentNode(id, parentId)
      }
      ctx.graph.deleteNode(booleanId)
      // Back to their own places in the stack, lowest first so each index is still free.
      for (const pos of origPositions) {
        ctx.graph.insertChildAt(pos.id, parentId, pos.index)
        ctx.graph.updateNode(pos.id, { x: pos.x, y: pos.y })
      }
      ctx.setSelectedIds(prevSelection)
    }
  })

  return booleanId
}

function operationLabel(operation: BooleanOperation) {
  switch (operation) {
    case 'UNION':
      return 'Union'
    case 'SUBTRACT':
      return 'Subtract'
    case 'INTERSECT':
      return 'Intersect'
    case 'EXCLUDE':
      return 'Exclude'
    default: {
      const exhaustive: never = operation
      return exhaustive
    }
  }
}
