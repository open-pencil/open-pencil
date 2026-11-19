import { compact } from 'es-toolkit/array'

import {
  fitEnclosingGroups,
  redoGroupFit,
  undoGroupFit
} from '@open-pencil/scene-graph/group-bounds'

import { groupFitOptions } from '#core/canvas/boolean'
import type { EditorContext } from '#core/editor/types'

/**
 * Refits the groups and booleans around these parents after their layers moved, came, or went, as
 * one undo step; a group left empty goes away. An auto layout around a group that changed lays out
 * again, so the layers beside it make room. The fit itself is shared with the plugin API; see
 * `fitEnclosingGroups` in Scene Graph.
 */
export function fitEnclosingGroupsWithUndo(ctx: EditorContext, parentIds: Iterable<string>) {
  const fit = fitEnclosingGroups(
    ctx.graph,
    parentIds,
    groupFitOptions(ctx.getRenderer(), ctx.graph)
  )
  if (!fit) return
  const fittedParents = compact([
    ...[...fit.before.keys()].map((id) => ctx.graph.getNode(id)?.parentId),
    ...fit.removed.map(({ node }) => node.parentId)
  ])
  const layoutAround = () => ctx.runLayoutForParents(fittedParents)
  layoutAround()
  ctx.undo.push({
    label: 'Fit groups',
    forward: () => {
      redoGroupFit(ctx.graph, fit)
      layoutAround()
    },
    inverse: () => {
      undoGroupFit(ctx.graph, fit)
      layoutAround()
    }
  })
}

/**
 * Refits these containers themselves and the groups around them: a boolean operation whose
 * operation changed takes the box of its new result, as it does when an operand moves.
 */
export function refitContainers(ctx: EditorContext, ids: Iterable<string>) {
  fitEnclosingGroups(ctx.graph, ids, groupFitOptions(ctx.getRenderer(), ctx.graph))
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
