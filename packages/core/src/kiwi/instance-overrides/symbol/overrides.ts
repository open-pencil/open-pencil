import { resolveOverrideTarget, repopulateInstance } from '#core/kiwi/instance-overrides/resolve'
import type { OverrideContext } from '#core/kiwi/instance-overrides/types'
import { guidToString } from '#core/kiwi/node-change/convert'
import type { SceneNode } from '#core/scene-graph'

import { convertOverrideToProps } from './props'

function isActiveInstance(ctx: OverrideContext, nodeId: string | undefined): nodeId is string {
  return nodeId !== undefined && (!ctx.activeNodeIds || ctx.activeNodeIds.has(nodeId))
}

function preserveStrokeShapeProps(target: SceneNode, updates: Partial<SceneNode>): void {
  if (!updates.strokes) return
  updates.strokes = updates.strokes.map((stroke, index) => {
    if (index >= target.strokes.length) {
      return {
        ...stroke,
        cap: target.strokeCap,
        join: target.strokeJoin,
        dashPattern: target.dashPattern
      }
    }
    const existing = target.strokes[index]
    return {
      ...stroke,
      cap: existing.cap,
      join: existing.join,
      dashPattern: existing.dashPattern
    }
  })
}

/**
 * Apply symbolOverrides from kiwi data.
 *
 * Handles instance swaps (overriddenSymbolID) and property overrides
 * (fills, text, visibility, etc.). Returns the set of directly
 * overridden node IDs (used as seeds for transitive sync).
 */
export function applySymbolOverrides(ctx: OverrideContext): Set<string> {
  const overriddenNodes = new Set<string>()
  ctx.componentIdRoot.clear()

  for (const [ncId, nc] of ctx.changeMap) {
    if (nc.type !== 'INSTANCE') continue
    const overrides = nc.symbolData?.symbolOverrides
    if (!overrides?.length) continue

    const nodeId = ctx.guidToNodeId.get(ncId)
    if (!isActiveInstance(ctx, nodeId)) continue

    for (const ov of overrides) {
      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, nodeId, guids)
      if (!targetId) continue

      if (targetId === nodeId && ctx.kiwiPropertyNodes.has(nodeId)) continue

      overriddenNodes.add(targetId)

      if (ov.overriddenSymbolID) {
        const swapGuid = guidToString(ov.overriddenSymbolID)
        const newCompId = ctx.guidToNodeId.get(swapGuid)
        if (newCompId) {
          repopulateInstance(ctx, targetId, newCompId)
          ctx.swappedInstances.add(targetId)
        }
      }

      const { guidPath: _, overriddenSymbolID: _s, componentPropAssignments: _c, ...fields } = ov
      if (Object.keys(fields).length === 0) continue

      const updates = convertOverrideToProps(fields as Record<string, unknown>)
      if (Object.keys(updates).length > 0) {
        const target = ctx.graph.getNode(targetId)
        if (target) preserveStrokeShapeProps(target, updates)
        ctx.graph.updateNode(targetId, updates)
      }
    }
  }
  return overriddenNodes
}
