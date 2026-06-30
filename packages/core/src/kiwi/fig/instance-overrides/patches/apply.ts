import type { SceneNode } from '@open-pencil/scene-graph'

import { repopulateInstance } from '#core/kiwi/fig/instance-overrides/resolve'
import type { OverrideContext } from '#core/kiwi/fig/instance-overrides/types'

import { protectField, protectPatchProps } from './protection'
import type { OverridePatch } from './types'

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

export function applyOverridePatch(ctx: OverrideContext, patch: OverridePatch): boolean {
  let changed = false
  if (patch.swapComponentId) {
    repopulateInstance(ctx, patch.targetId, patch.swapComponentId)
    protectField(ctx.protectedFields, patch.targetId, 'structure')
    changed = true
  }

  if (patch.props && Object.keys(patch.props).length > 0) {
    const target = ctx.graph.getNode(patch.targetId)
    if (target) {
      const props = patch.props
      preserveStrokeShapeProps(target, props)
      ctx.graph.preserveSourceMetadataDuring(() => ctx.graph.updateNode(patch.targetId, props))
      protectPatchProps(ctx.protectedFields, patch.targetId, props)
      changed = true
    }
  }
  return changed
}
