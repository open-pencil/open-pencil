import { applyOverridePatch } from '../patches'
import { resolveOverrideTarget } from '../resolve'
import type { OverrideContext } from '../types'
import { patchFromSymbolOverride } from './patches'

function isActiveInstance(ctx: OverrideContext, nodeId: string | undefined): nodeId is string {
  return nodeId !== undefined && (!ctx.activeNodeIds || ctx.activeNodeIds.has(nodeId))
}

function preserveInstanceRootBounds(
  hasRootSize: boolean,
  instanceId: string,
  targetId: string,
  patch: ReturnType<typeof patchFromSymbolOverride>
): void {
  if (!hasRootSize || targetId !== instanceId || !patch?.props) return
  // Root bounds belong to the instance NodeChange. Figma may repeat the
  // source component size in a root symbol override, but that must not resize
  // the placed instance.
  delete patch.props.width
  delete patch.props.height
}

/**
 * Apply symbolOverrides from kiwi data.
 *
 * Handles instance swaps (overriddenSymbolID) and property overrides
 * (fills, text, visibility, etc.). Returns the set of directly
 * overridden node IDs (used as seeds for transitive sync).
 */
export function applySymbolOverrides(ctx: OverrideContext, propertiesOnly = false): Set<string> {
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

      const patch = patchFromSymbolOverride(ctx, targetId, ov)
      if (!patch) continue
      preserveInstanceRootBounds(nc.size !== undefined, nodeId, targetId, patch)
      if (propertiesOnly) patch.swapComponentId = undefined
      if (!patch.swapComponentId && !patch.props) continue
      overriddenNodes.add(targetId)
      applyOverridePatch(ctx, patch)
    }
  }
  return overriddenNodes
}
