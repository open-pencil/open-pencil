import type {
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneNode
} from '@open-pencil/scene-graph'

import { MIXED, type MixedValue } from '#vue/controls/node-props/helpers'

export interface ComponentPropertyOption {
  value: string
  label: string
  missing?: boolean
  disabled?: boolean
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

export function instanceSwapOptions(
  components: SceneNode[],
  definition: ComponentPropertyDefinition,
  value: string
): ComponentPropertyOption[] {
  const preferred = new Set(definition.preferredValues)
  const options: ComponentPropertyOption[] = components
    .filter((node) => node.type === 'COMPONENT')
    .map((node) => ({
      value: node.id,
      label: node.name,
      preferred:
        preferred.has(node.componentKey ?? '') || preferred.has(node.sourceLibraryKey ?? '')
    }))
    .sort(
      (left, right) =>
        Number(right.preferred) - Number(left.preferred) || left.label.localeCompare(right.label)
    )
    .map(({ value: optionValue, label }) => ({ value: optionValue, label }))
  if (value && !options.some((option) => option.value === value)) {
    options.push({ value, label: value, missing: true })
  }
  return options
}
