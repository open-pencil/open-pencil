import type { SceneGraph } from '../index'
import type { SceneNode } from '../types'

/** Variants in reading order on the canvas: top to bottom, then left to right, then by name. */
export function compareCanvasPosition(a: SceneNode, b: SceneNode): number {
  return a.y - b.y || a.x - b.x || a.name.localeCompare(b.name)
}

/**
 * A component set's default variant, the one an instance starts as: the variant in its
 * top-left corner, as Figma defines it.
 */
export function defaultVariant(graph: SceneGraph, set: SceneNode): SceneNode | undefined {
  return graph
    .getChildren(set.id)
    .filter((child) => child.type === 'COMPONENT')
    .sort(compareCanvasPosition)[0]
}

/**
 * The value a variant property starts at: its recorded default when that is one of its options,
 * or else the default variant's, since a document may leave the recorded default empty.
 */
export function variantDefaultValue(
  graph: SceneGraph,
  set: SceneNode,
  property: { name: string; defaultValue: string; variantOptions?: string[] }
): string {
  if (property.variantOptions?.includes(property.defaultValue)) return property.defaultValue
  return defaultVariant(graph, set)?.componentPropertyValues[property.name] ?? property.defaultValue
}

/**
 * The variant with every property at its default value: the recorded defaults when they name a
 * variant, else the default variant, as a document that leaves them out draws it.
 */
export function restingVariant(graph: SceneGraph, set: SceneNode): SceneNode | undefined {
  const properties = set.componentPropertyDefinitions.filter(
    (definition) => definition.type === 'VARIANT'
  )
  const values = properties.map(
    (property) => [property.name, variantDefaultValue(graph, set, property)] as const
  )
  return (
    graph
      .getChildren(set.id)
      .find(
        (child) =>
          child.type === 'COMPONENT' &&
          values.every(([name, value]) => child.componentPropertyValues[name] === value)
      ) ?? defaultVariant(graph, set)
  )
}
