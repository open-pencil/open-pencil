import { fitEnclosingGroups, redoGroupFit, undoGroupFit } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

/**
 * Refits the groups and booleans around these parents after a move, as one undo step. The fit
 * itself is shared with the plugin API; see `fitEnclosingGroups` in Scene Graph.
 */
export function fitEnclosingGroupsWithUndo(ctx: EditorContext, parentIds: Iterable<string>) {
  const fit = fitEnclosingGroups(ctx.graph, parentIds)
  if (!fit) return
  ctx.undo.push({
    label: 'Fit groups',
    forward: () => redoGroupFit(ctx.graph, fit),
    inverse: () => undoGroupFit(ctx.graph, fit)
  })
}
