import { uniq } from 'es-toolkit/array'

import type { ComponentPropertyDefinition, SceneNode } from './types'
import { buildVariantName, parseVariantName } from './variant-name'

export interface DerivedVariantProperties {
  definitions: ComponentPropertyDefinition[]
  variants: Map<string, Pick<SceneNode, 'componentPropertyValues' | 'name'>>
}

export function deriveSlashVariantProperties(
  components: ReadonlyArray<Pick<SceneNode, 'id' | 'name'>>,
  createPropertyId: () => string
): DerivedVariantProperties | null {
  const slashCounts = components.map((component) => (component.name.match(/\//g) ?? []).length)
  const slashCount = slashCounts[0] ?? 0
  if (slashCount === 0 || !slashCounts.every((count) => count === slashCount)) return null

  const definitions: ComponentPropertyDefinition[] = Array.from(
    { length: slashCount },
    (_, index) => ({
      id: createPropertyId(),
      name: index === 0 ? 'Variant' : `Property ${index + 1}`,
      type: 'VARIANT',
      defaultValue: ''
    })
  )
  const options = new Map(definitions.map((definition) => [definition.name, new Set<string>()]))
  const variants = new Map<string, Pick<SceneNode, 'componentPropertyValues' | 'name'>>()

  for (const component of components) {
    const parts = component.name.split('/').slice(1)
    const componentPropertyValues: Record<string, string> = {}
    for (const [index, definition] of definitions.entries()) {
      const value = parts[index]?.trim() ?? ''
      componentPropertyValues[definition.name] = value
      options.get(definition.name)?.add(value)
    }
    variants.set(component.id, {
      componentPropertyValues,
      name: Object.values(componentPropertyValues).join(', ')
    })
  }

  for (const definition of definitions) {
    definition.variantOptions = [...(options.get(definition.name) ?? [])]
    definition.defaultValue = definition.variantOptions[0] ?? ''
  }

  return { definitions, variants }
}

/**
 * Variant properties from names written as `Property=Value` pairs, as Figma names variants:
 * `State=On, Size=Large` gives State and Size. Every component must name at least one pair;
 * a property a component leaves out takes an empty value.
 */
export function deriveNamedVariantProperties(
  components: ReadonlyArray<Pick<SceneNode, 'id' | 'name'>>,
  createPropertyId: () => string
): DerivedVariantProperties | null {
  const parsed = components.map((component) => parseVariantName(component.name))
  if (parsed.some((values) => Object.keys(values).length === 0)) return null
  const names = uniq(parsed.flatMap((values) => Object.keys(values)))
  const definitions: ComponentPropertyDefinition[] = names.map((name) => {
    const options = uniq(parsed.map((values) => values[name] ?? ''))
    return {
      id: createPropertyId(),
      name,
      type: 'VARIANT',
      defaultValue: options[0] ?? '',
      variantOptions: options
    }
  })
  const variants = new Map(
    components.map((component, index) => {
      const componentPropertyValues = Object.fromEntries(
        names.map((name) => [name, parsed[index][name] ?? ''])
      )
      return [
        component.id,
        { componentPropertyValues, name: buildVariantName(componentPropertyValues) }
      ]
    })
  )
  return { definitions, variants }
}

/** Variant properties from component names: slash paths first, else `Property=Value` pairs. */
export function deriveVariantProperties(
  components: ReadonlyArray<Pick<SceneNode, 'id' | 'name'>>,
  createPropertyId: () => string
): DerivedVariantProperties | null {
  return (
    deriveSlashVariantProperties(components, createPropertyId) ??
    deriveNamedVariantProperties(components, createPropertyId)
  )
}
