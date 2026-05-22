import type { OverrideContext } from '#core/kiwi/fig/instance-overrides/types'

import { applyInstanceDirectAssignments, applyOverrideAssignments } from './assignments'
import { collectAssignmentsMap, collectPropRefsMap } from './maps'

/**
 * Apply all component property assignments (visibility toggles, instance swaps).
 *
 * Returns the set of modified node IDs so the caller can run a second
 * transitive sync to propagate the changes to deeper clones.
 */
export function applyComponentProperties(ctx: OverrideContext): Set<string> {
  const modified = new Set<string>()
  const propRefsMap = collectPropRefsMap(ctx)
  if (propRefsMap.size === 0) return modified

  applyInstanceDirectAssignments(ctx, collectAssignmentsMap(ctx), propRefsMap, modified)
  applyOverrideAssignments(ctx, propRefsMap, modified)

  return modified
}
