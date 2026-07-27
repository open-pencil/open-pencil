import type { SceneNode } from '@open-pencil/scene-graph'
import { copyEffects, copyStrokes } from '@open-pencil/scene-graph/copy'

import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'
import {
  createVectorFrameChildren,
  resolveVectorFramePlacement,
  type SVGVectorizeResult
} from '#core/vector/vectorize'

function hasRoundedCorners(node: SceneNode): boolean {
  return node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].some(
        (radius) => radius > 0
      )
    : node.cornerRadius > 0
}

function replacementFrameProps(node: SceneNode) {
  return {
    name: node.name,
    rotation: node.rotation,
    flipX: node.flipX,
    flipY: node.flipY,
    opacity: node.opacity,
    visible: node.visible,
    locked: node.locked,
    blendMode: node.blendMode,
    effects: copyEffects(node.effects),
    strokes: copyStrokes(node.strokes),
    strokeStyleId: node.strokeStyleId,
    strokeCap: node.strokeCap,
    strokeJoin: node.strokeJoin,
    strokeMiterLimit: node.strokeMiterLimit,
    dashPattern: [...node.dashPattern],
    cornerRadius: node.cornerRadius,
    topLeftRadius: node.topLeftRadius,
    topRightRadius: node.topRightRadius,
    bottomRightRadius: node.bottomRightRadius,
    bottomLeftRadius: node.bottomLeftRadius,
    independentCorners: node.independentCorners,
    cornerSmoothing: node.cornerSmoothing,
    clipsContent: node.clipsContent || hasRoundedCorners(node),
    horizontalConstraint: node.horizontalConstraint,
    verticalConstraint: node.verticalConstraint,
    layoutPositioning: node.layoutPositioning,
    layoutGrow: node.layoutGrow,
    layoutAlignSelf: node.layoutAlignSelf,
    minWidth: node.minWidth,
    maxWidth: node.maxWidth,
    minHeight: node.minHeight,
    maxHeight: node.maxHeight,
    isMask: node.isMask,
    maskType: node.maskType,
    maskIsOutline: node.maskIsOutline
  }
}

export function createVectorizeActions(ctx: EditorContext) {
  function replaceNodeWithVectorFrame(
    nodeId: string,
    vectorized: SVGVectorizeResult
  ): string | null {
    const node = ctx.graph.getNode(nodeId)
    const parentId = node?.parentId
    const parent = parentId ? ctx.graph.getNode(parentId) : null
    if (!node || !parentId || !parent) return null

    const insertIndex = parent.childIds.indexOf(node.id)
    if (insertIndex === -1) return null
    const placement = resolveVectorFramePlacement(node, vectorized.contentBounds)
    const originalSubtree = snapshotSubtree(ctx.graph, node.id)
    const previousSelection = new Set(ctx.state.selectedIds)

    const frame = ctx.graph.createNode('FRAME', parentId, {
      ...replacementFrameProps(node),
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      fills: []
    })
    ctx.graph.insertChildAt(frame.id, parentId, insertIndex)
    createVectorFrameChildren(ctx.graph, frame.id, vectorized, placement)
    if (frame.childIds.length === 0) {
      ctx.graph.deleteNode(frame.id)
      return null
    }

    const frameSubtree = snapshotSubtree(ctx.graph, frame.id)
    ctx.graph.deleteNode(node.id)
    ctx.setSelectedIds(new Set([frame.id]))

    ctx.undo.push({
      label: 'Vectorize image',
      forward: () => {
        if (ctx.graph.getNode(node.id)) ctx.graph.deleteNode(node.id)
        const frameRoot = frameSubtree.get(frame.id)
        if (frameRoot && !ctx.graph.getNode(frame.id)) {
          restoreSubtree(ctx.graph, frameRoot, parentId, frameSubtree)
          ctx.graph.insertChildAt(frame.id, parentId, insertIndex)
        }
        ctx.setSelectedIds(new Set([frame.id]))
        ctx.requestRender()
      },
      inverse: () => {
        if (ctx.graph.getNode(frame.id)) ctx.graph.deleteNode(frame.id)
        const originalRoot = originalSubtree.get(node.id)
        if (originalRoot && !ctx.graph.getNode(node.id)) {
          restoreSubtree(ctx.graph, originalRoot, parentId, originalSubtree)
          ctx.graph.insertChildAt(node.id, parentId, insertIndex)
        }
        ctx.setSelectedIds(previousSelection)
        ctx.requestRender()
      }
    })

    ctx.requestRender()
    return frame.id
  }

  return { replaceNodeWithVectorFrame }
}
