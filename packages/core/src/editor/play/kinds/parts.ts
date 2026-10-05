import {
  instanceSlotFrames,
  slotPropertyId,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { PlayTarget } from '#core/editor/play/session'

/** The document instance's slot frame bound to a part, for where it sits on the canvas. */
export function documentPartFrame(
  graph: SceneGraph,
  target: PlayTarget,
  partId: string
): SceneNode | undefined {
  const propertyId = target.behaviour.parts[partId]
  return propertyId
    ? instanceSlotFrames(graph, target.instance).find(
        (frame) => slotPropertyId(frame) === propertyId
      )
    : undefined
}

/** Which child of a part's slot frame holds the node, if any. */
export function partItemIndex(
  graph: SceneGraph,
  target: PlayTarget,
  partId: string,
  nodeId: string
): number | null {
  const frame = documentPartFrame(graph, target, partId)
  if (!frame) return null
  let current = graph.getNode(nodeId)
  while (current?.parentId && current.parentId !== frame.id)
    current = graph.getNode(current.parentId)
  return current?.parentId === frame.id ? frame.childIds.indexOf(current.id) : null
}
