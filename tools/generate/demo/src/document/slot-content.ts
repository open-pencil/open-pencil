import type { TreeNode } from '@lawha/design-jsx'
import type { SceneGraph } from '@lawha/scene-graph'
import {
  claimSlotContent,
  instanceSlotFrames,
  slotPropertyId,
  slotScope
} from '@lawha/scene-graph/slots'

import { renderTree } from './icons'

/** Replace what the instance shows in the slot: it owns the content from then on. */
export async function fillSlot(
  graph: SceneGraph,
  instanceId: string,
  slotId: string,
  content: TreeNode
): Promise<void> {
  const instance = graph.getNode(instanceId)
  const frame = instance
    ? instanceSlotFrames(graph, instance).find((slot) => slotPropertyId(slot) === slotId)
    : undefined
  const scope = frame ? slotScope(graph, frame.id) : null
  if (!frame || scope?.kind !== 'slot') throw new Error('The instance has no such slot')
  claimSlotContent(graph, scope)
  for (const childId of Array.from(frame.childIds)) graph.deleteNode(childId)
  await renderTree(graph, content, { parentId: frame.id })
}
