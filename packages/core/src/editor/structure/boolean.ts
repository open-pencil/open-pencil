import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'

import { canMakeBooleanSourceNode } from '#core/canvas/boolean'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'

import { wrapNodes } from './container-wrap'
import { selectedNodesInSharedParent } from './selection'

export type BooleanOperation = 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE'

/**
 * Wraps sibling layers in a boolean operation named after it, as Figma names one from the canvas
 * and from the plugin API. Shared by the editor command and the plugin API; `props` gives the look.
 */
export function createBooleanOperation(
  graph: SceneGraph,
  nodes: readonly SceneNode[],
  parentId: string,
  operation: BooleanOperation,
  index: number | undefined,
  props: Partial<SceneNode> = {}
): SceneNode {
  return wrapNodes(graph, 'BOOLEAN_OPERATION', nodes, parentId, index, {
    name: operationLabel(operation),
    booleanOperation: operation,
    ...props
  })
}

export function booleanOperationSelected(
  ctx: EditorContext,
  selectedNodes: SceneNode[],
  operation: BooleanOperation
) {
  const selection = selectedNodesInSharedParent(ctx, selectedNodes)
  if (!selection || selection.topLevel.length < 2) return null
  const { topLevel, parentId, parent } = selection
  if (topLevel.some((node) => !canMakeBooleanSourceNode(node, ctx.graph))) return null

  const prevSelection = new Set(ctx.state.selectedIds)
  const childIds = topLevel.map((node) => node.id)
  const childSnapshots = childIds.map((id) => ({ id, subtree: snapshotSubtree(ctx.graph, id) }))
  const origPositions = topLevel.map((node) => ({ id: node.id, x: node.x, y: node.y }))
  const firstIndex = Math.min(...childIds.map((id) => parent.childIds.indexOf(id)))
  const booleanNode = createBooleanOperation(ctx.graph, topLevel, parentId, operation, firstIndex, {
    fills: copyFills(topLevel[0].fills),
    strokes: copyStrokes(topLevel[0].strokes)
  })
  const booleanId = booleanNode.id
  ctx.setSelectedIds(new Set([booleanId]))

  ctx.undo.push({
    label: operationLabel(operation),
    forward: () => {
      const restored = ctx.graph.createNode('BOOLEAN_OPERATION', parentId, {
        ...booleanNode,
        childIds: [],
        id: booleanId
      })
      ctx.graph.insertChildAt(restored.id, parentId, firstIndex)
      for (const id of childIds) ctx.graph.reparentNode(id, restored.id)
      ctx.setSelectedIds(new Set([restored.id]))
    },
    inverse: () => {
      for (const { id, subtree } of childSnapshots) {
        const root = subtree.get(id)
        if (!root) continue
        if (!ctx.graph.getNode(id)) restoreSubtree(ctx.graph, root, parentId, subtree)
        else ctx.graph.reparentNode(id, parentId)
      }
      for (let i = 0; i < childIds.length; i++) {
        const id = childIds[i]
        const pos = origPositions[i]
        ctx.graph.insertChildAt(id, parentId, firstIndex + i)
        ctx.graph.updateNode(id, { x: pos.x, y: pos.y })
      }
      ctx.graph.deleteNode(booleanId)
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
