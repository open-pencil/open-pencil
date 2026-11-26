import type { CodeComponentId, NodeChange } from '@open-pencil/kiwi/fig/codec'

import { forEachOverrideRecord } from '../instance-overrides/types'

/**
 * Include the shader definitions a record's shader paints and effects name, including those its
 * overrides name, so the internal page's definition travels with the layer that uses it.
 */
export function shaderDependencies(
  node: NodeChange,
  resolve: (reference: CodeComponentId) => string | undefined,
  available: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>()
  forEachOverrideRecord(node, (record) => {
    for (const paint of [
      ...(record.fillPaints ?? []),
      ...(record.strokePaints ?? []),
      ...(record.effects ?? [])
    ]) {
      if (paint.type !== 'CUSTOM' || !paint.customEffectId) continue
      const id = resolve(paint.customEffectId)
      if (id && available.has(id)) result.add(id)
    }
  })
  return result
}
