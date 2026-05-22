import { applyOverridePatch } from '#core/kiwi/fig/instance-overrides/patches'
import { resolveOverrideTarget } from '#core/kiwi/fig/instance-overrides/resolve'
import type {
  DerivedSymbolOverride,
  OverrideContext
} from '#core/kiwi/fig/instance-overrides/types'

import { buildDsdLayoutUpdates } from './layout'
import { propagateDsdChanges } from './propagate'

function applyDsdOverride(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  nodeId: string,
  d: DerivedSymbolOverride,
  modified: Set<string>,
  sizeSet: Set<string>
): void {
  const guids = d.guidPath?.guids
  if (!guids?.length) return

  const targetId = resolveOverrideTarget(ctx, nodeId, guids)
  if (!targetId) return

  const target = ctx.graph.getNode(targetId)
  if (!target) return

  const { updates, hasSize } = buildDsdLayoutUpdates(ctx, visibleSiblingCount, d, target)
  if (d.fillGeometry?.length || d.strokeGeometry?.length) ctx.geometryOverrideNodes.add(targetId)
  if (Object.keys(updates).length === 0) return

  if (applyOverridePatch(ctx, { targetId, source: 'derived-symbol-data', props: updates })) {
    modified.add(targetId)
  }
  if (hasSize) sizeSet.add(targetId)
}

function resolveDsdUpdates(ctx: OverrideContext): { modified: Set<string>; sizeSet: Set<string> } {
  const modified = new Set<string>()
  const sizeSet = new Set<string>()
  const visibleSiblingCount = new Map<string, number>()

  for (const [ncId, nc] of ctx.changeMap) {
    if (nc.type !== 'INSTANCE') continue
    const derived = nc.derivedSymbolData
    if (!derived?.length) continue

    const nodeId = ctx.guidToNodeId.get(ncId)
    if (!nodeId || (ctx.activeNodeIds && !ctx.activeNodeIds.has(nodeId))) continue

    for (const d of derived)
      applyDsdOverride(ctx, visibleSiblingCount, nodeId, d, modified, sizeSet)
  }

  return { modified, sizeSet }
}

export function applyDerivedSymbolData(ctx: OverrideContext): void {
  const { modified, sizeSet } = resolveDsdUpdates(ctx)
  propagateDsdChanges(ctx, modified, sizeSet)
}
