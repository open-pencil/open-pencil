import { enforcedAspectRatio } from '../layout/aspect-ratio'
import { layoutConstrainedChildRect } from '../resize'
import type { SceneNode } from '../types'

/** The fields that say where a copy sits in its parent. */
export const PLACEMENT_FIELDS: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height'])

/**
 * The component's layer placed in the copy's parent: where its constraints put it when the
 * instance's frame has another size than the component's, as Figma resizes an instance.
 */
export function placedByConstraints(
  source: SceneNode,
  compParent: SceneNode,
  instParent: SceneNode,
  factor: number
): SceneNode {
  const before = { width: compParent.width * factor, height: compParent.height * factor }
  if (before.width === instParent.width && before.height === instParent.height) return source
  const rect = layoutConstrainedChildRect(
    source,
    before,
    instParent,
    source.horizontalConstraint,
    source.verticalConstraint,
    enforcedAspectRatio(source)
  )
  return { ...source, ...rect }
}
