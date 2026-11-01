import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { TreeNode } from '../tree'

export interface RenderOptions {
  x?: number
  y?: number
  /** Each root's position, in the order the roots are written; an entry replaces `x` and `y`. */
  positions?: ReadonlyArray<Partial<Vector>>
  parentId?: string
  /** Called for every layer created from an element, so callers can map source to layers. */
  onNode?: (tree: TreeNode, node: SceneNode) => void
  /** Leave layout to the caller, which lays out once after moving the roots into place. */
  deferLayout?: boolean
}
