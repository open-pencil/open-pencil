// What a moving or resizing layer snaps to: its siblings and, as in Figma, the frame it sits in.
import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { worldBoundsNode } from '#vue/shared/input/snap/resolve'

/** Containers whose bounds come from their children, so a child snapping to them would chase itself. */
const DERIVED_BOUNDS_TYPES = new Set<SceneNode['type']>(['CANVAS', 'GROUP', 'BOOLEAN_OPERATION'])

/**
 * What a layer moving or resizing inside `parentId` snaps to: its visible siblings and the edges
 * and center of the frame it sits in.
 */
export function layerSnapTargets(
  parentId: string,
  movingIds: ReadonlySet<string>,
  editor: Editor
): SceneNode[] {
  const siblings = editor.graph
    .getChildren(parentId)
    .filter((node) => node.visible && !movingIds.has(node.id))
    .map((node) => worldBoundsNode(node, editor))
  const parent = editor.graph.getNode(parentId)
  if (!parent || DERIVED_BOUNDS_TYPES.has(parent.type)) return siblings
  return [...siblings, worldBoundsNode(parent, editor)]
}
