import type { Editor } from '@open-pencil/core/editor'
import { canCreateInstance } from '@open-pencil/scene-graph'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'

import { MIXED, type MixedValue } from '#vue/controls/node-props/helpers'

export interface ComponentPropertyOption {
  value: string
  label: string
  missing?: boolean
  disabled?: boolean
  /** A swap choice the property's definition recommends. */
  preferred?: boolean
}

export interface ComponentPropertyControl {
  id: string
  name: string
  type: ComponentPropertyType
  value: MixedValue<string>
  options: ComponentPropertyOption[]
}

export function compatibleComponentPropertyDefinitions(
  definitions: ComponentPropertyDefinition[][]
): ComponentPropertyDefinition[] {
  if (definitions.length === 0) return []
  const first = definitions[0]
  const signature = (items: ComponentPropertyDefinition[]) =>
    items.map((item) => `${item.id}:${item.type}`).join('\u0000')
  const expected = signature(first)
  return definitions.every((items) => signature(items) === expected) ? first : []
}

export function mergedComponentPropertyValue(values: string[]): MixedValue<string> {
  const first = values[0] ?? ''
  return values.every((value) => value === first) ? first : MIXED
}

/** A swap choice's name; a variant names its set too, since variant names repeat across sets. */
export function swapOptionLabel(graph: SceneGraph, component: SceneNode): string {
  const parent = component.parentId ? graph.getNode(component.parentId) : undefined
  return parent?.type === 'COMPONENT_SET' ? `${parent.name} / ${component.name}` : component.name
}

/**
 * Components a swap property can show, preferred ones first. `parentIds` are the containers of
 * the layers it swaps; a component that holds one of them would contain itself and is left out.
 */
export function instanceSwapOptions(
  graph: SceneGraph,
  components: SceneNode[],
  definition: ComponentPropertyDefinition,
  value: string,
  parentIds: readonly string[] = []
): ComponentPropertyOption[] {
  const preferred = new Set(definition.preferredValues)
  const options: ComponentPropertyOption[] = components
    .filter(
      (node) =>
        node.type === 'COMPONENT' &&
        parentIds.every((parentId) => canCreateInstance(graph, node.id, parentId))
    )
    .map((node) => ({
      value: node.id,
      label: swapOptionLabel(graph, node),
      preferred:
        preferred.has(node.componentKey ?? '') || preferred.has(node.sourceLibraryKey ?? '')
    }))
    .sort(
      (left, right) =>
        Number(right.preferred) - Number(left.preferred) || left.label.localeCompare(right.label)
    )
  if (value && !options.some((option) => option.value === value)) {
    const current = graph.getNode(value)
    options.push({
      value,
      label: current ? swapOptionLabel(graph, current) : value,
      missing: !current
    })
  }
  return options
}

export function variantOptions(
  editor: Editor,
  instance: SceneNode,
  propertyName: string
): ComponentPropertyOption[] {
  return editor
    .getVariantOptionAvailability(instance.id, propertyName)
    .map(({ value, available }) => ({
      value,
      label: value,
      disabled: !available
    }))
}
