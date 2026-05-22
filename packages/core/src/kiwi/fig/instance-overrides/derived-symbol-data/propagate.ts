import { buildClonesMap } from '#core/kiwi/fig/instance-overrides/sync'
import type { OverrideContext } from '#core/kiwi/fig/instance-overrides/types'
import type { SceneNode } from '#core/scene-graph'
import { copyGeometryPaths } from '#core/scene-graph/copy'

function buildCloneUpdates(
  ctx: OverrideContext,
  source: SceneNode,
  clone: SceneNode,
  cloneId: string,
  sizeSet: Set<string>
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (sizeSet.has(cloneId)) return updates
  if (source.width !== clone.width) updates.width = source.width
  if (source.height !== clone.height) updates.height = source.height
  if (source.x !== clone.x) updates.x = source.x
  if (source.y !== clone.y) updates.y = source.y
  if (!ctx.geometryOverrideNodes.has(cloneId)) {
    if (source.fillGeometry !== clone.fillGeometry)
      updates.fillGeometry = copyGeometryPaths(source.fillGeometry)
    if (source.strokeGeometry !== clone.strokeGeometry)
      updates.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
  }
  if (source.text === clone.text && source.figmaDerivedTextGlyphs) {
    updates.figmaDerivedTextGlyphs = structuredClone(source.figmaDerivedTextGlyphs)
  }
  if (source.text === clone.text && source.figmaDerivedLayout) {
    updates.figmaDerivedLayout = { ...source.figmaDerivedLayout }
  }
  return updates
}

export function propagateDsdChanges(
  ctx: OverrideContext,
  modified: Set<string>,
  sizeSet: Set<string>
): void {
  if (modified.size === 0) return

  const clonesOf = buildClonesMap(ctx.graph, ctx.activeNodeIds)
  const queue = [...modified]
  const visited = new Set<string>()

  let index = 0
  while (index < queue.length) {
    const sourceId = queue[index]
    index++
    const source = ctx.graph.getNode(sourceId)
    if (!source) continue
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    for (const cloneId of clones) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = ctx.graph.getNode(cloneId)
      if (!clone) continue
      const updates = buildCloneUpdates(ctx, source, clone, cloneId, sizeSet)
      if (Object.keys(updates).length > 0) {
        ctx.graph.preserveSourceMetadataDuring(() => ctx.graph.updateNode(cloneId, updates))
      }
      queue.push(cloneId)
    }
  }
}
