import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { defaultVariant } from '@open-pencil/scene-graph/components'

export interface AssetComponent {
  component: SceneNode
  /** The asset has no variant with the property values asked for, so its default stands in. */
  fallback: boolean
}

function sameVariant(left: SceneNode, right: SceneNode): boolean {
  const entries = Object.entries(left.componentPropertyValues)
  return (
    entries.length === Object.keys(right.componentPropertyValues).length &&
    entries.every(([name, value]) => right.componentPropertyValues[name] === value)
  )
}

/** The components of a library asset: itself when it is one, or else its set's variants. */
export function assetComponents(graph: SceneGraph, root: SceneNode): SceneNode[] {
  if (root.type === 'COMPONENT') return [root]
  if (root.type !== 'COMPONENT_SET') return []
  return graph.getChildren(root.id).filter((child) => child.type === 'COMPONENT')
}

/**
 * The component of a library asset that stands for `like`: the variant with its property values,
 * or else the asset's default variant, the top-left one. An asset that is a single component is
 * its own default. Without `like`, the default.
 */
export function assetComponent(
  graph: SceneGraph,
  root: SceneNode,
  like?: SceneNode
): AssetComponent | undefined {
  if (root.type !== 'COMPONENT' && root.type !== 'COMPONENT_SET') return undefined
  const candidates = assetComponents(graph, root)
  const same = like ? candidates.find((candidate) => sameVariant(like, candidate)) : undefined
  const component = same ?? (root.type === 'COMPONENT' ? root : defaultVariant(graph, root))
  return component ? { component, fallback: !same } : undefined
}
