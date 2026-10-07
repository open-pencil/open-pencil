import type { SceneGraph } from '../index'
import type { ComponentPropertyDefinition, SceneNode } from '../types'

/** A limit a slot's content breaks, named as Figma's `SlotNode.limitViolations` names them. */
export type SlotLimitViolation = 'BELOW_MIN' | 'ABOVE_MAX' | 'HAS_NON_PREFERRED'

/** Whether a component is among a slot's preferred values, by id, key, or library key. */
export function isPreferredComponent(
  component: SceneNode | undefined,
  preferredValues: readonly string[] = []
): boolean {
  if (!component) return false
  return [component.id, component.componentKey, component.sourceLibraryKey].some(
    (value) => !!value && preferredValues.includes(value)
  )
}

/** Content layers a preferred-only slot does not allow: anything but preferred instances. */
export function nonPreferredLayers(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition,
  content: readonly SceneNode[]
): SceneNode[] {
  if (!definition.slotSettings?.allowPreferredValuesOnly) return []
  return content.filter(
    (node) =>
      node.type !== 'INSTANCE' ||
      !isPreferredComponent(
        node.componentId ? graph.getNode(node.componentId) : undefined,
        definition.preferredValues
      )
  )
}

/** The limits a slot's content breaks; below-minimum and above-maximum exclude each other. */
export function slotLimitViolations(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition,
  content: readonly SceneNode[]
): SlotLimitViolation[] {
  const settings = definition.slotSettings
  const violations: SlotLimitViolation[] = []
  if (settings?.minChildren !== undefined && content.length < settings.minChildren)
    violations.push('BELOW_MIN')
  else if (settings?.maxChildren !== undefined && content.length > settings.maxChildren)
    violations.push('ABOVE_MAX')
  if (nonPreferredLayers(graph, definition, content).length) violations.push('HAS_NON_PREFERRED')
  return violations
}
