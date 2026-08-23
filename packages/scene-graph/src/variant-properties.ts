import type { ComponentPropertyDefinition, SceneNode } from './types'

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
