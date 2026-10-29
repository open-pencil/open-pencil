import { compact } from 'es-toolkit/array'

import {
  fitEnclosingGroups,
  redoGroupFit,
  undoGroupFit
} from '@open-pencil/scene-graph/group-bounds'

import { groupFitOptions } from '#core/canvas/boolean'
import type { EditorContext } from '#core/editor/types'

/**
 * Refits the groups and booleans around these parents after a move, as one undo step. The fit
 * itself is shared with the plugin API; see `fitEnclosingGroups` in Scene Graph.
 */
export function fitEnclosingGroupsWithUndo(ctx: EditorContext, parentIds: Iterable<string>) {
  const fit = fitEnclosingGroups(
    ctx.graph,
    parentIds,
    groupFitOptions(ctx.getRenderer(), ctx.graph)
  )
  if (!fit) return
  ctx.undo.push({
    label: 'Fit groups',
    forward: () => redoGroupFit(ctx.graph, fit),
    inverse: () => undoGroupFit(ctx.graph, fit)
  })
}

/**
 * Refits the groups around layers that were shown or hidden, since a group spans only the layers
 * it shows. The fit follows from what the layers show, so an edit that replays on undo and redo
 * refits again and needs no undo step of its own.
 */
export function refitGroupsAroundLayers(ctx: EditorContext, layerIds: Iterable<string>) {
  const parentIds = compact([...layerIds].map((id) => ctx.graph.getNode(id)?.parentId))
  fitEnclosingGroups(ctx.graph, parentIds, groupFitOptions(ctx.getRenderer(), ctx.graph))
}
