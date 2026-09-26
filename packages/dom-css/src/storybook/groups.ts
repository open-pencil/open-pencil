import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import { claimName } from './names'

export interface StoryVariant {
  values: string[]
  node: SceneNode
}

/** One story file: a component set, a standalone component, or slash-named siblings. */
export interface StoryGroup {
  page: SceneNode
  title: string
  name: string
  props: { name: string; options: string[] }[]
  variants: StoryVariant[]
  /** Layer the story file links to, when the group has a layer of its own. */
  linkNode?: string
}

function isExported(node: SceneNode): boolean {
  return node.visible && !node.internalOnly
}

/** Variants whose property values collide are told apart by layer name instead. */
function distinctVariants(group: StoryGroup): StoryGroup {
  const keys = group.variants.map((variant) => JSON.stringify(variant.values))
  if (new Set(keys).size === keys.length) return group
  const taken = new Set<string>()
  return {
    ...group,
    variants: group.variants.map((variant) => ({
      ...variant,
      values: [claimName(variant.node.name, taken, { separator: ' ' })]
    })),
    props: [{ name: 'Variant', options: [...taken] }]
  }
}

function componentSetGroup(graph: SceneGraph, page: SceneNode, set: SceneNode): StoryGroup {
  const definitions = set.componentPropertyDefinitions.filter((def) => def.type === 'VARIANT')
  const variants = graph
    .getChildren(set.id)
    .filter((child) => child.type === 'COMPONENT' && isExported(child))
    .map((component) => ({
      values: definitions.map((def) => component.componentPropertyValues[def.name] ?? ''),
      node: component
    }))
  const props = definitions.map((def, index) => ({
    name: def.name,
    options: [
      ...new Set([...(def.variantOptions ?? []), ...variants.map((v) => v.values[index] ?? '')])
    ]
  }))
  return distinctVariants({
    page,
    title: `${page.name}/${set.name}`,
    name: set.name,
    props,
    variants,
    linkNode: set.name
  })
}

function componentGroup(page: SceneNode, component: SceneNode): StoryGroup {
  return {
    page,
    title: `${page.name}/${component.name}`,
    name: component.name,
    props: [],
    variants: [{ values: [], node: component }],
    linkNode: component.name
  }
}

/** `Button/Primary`, `Button/Secondary` → one `Button` group with a derived variant property. */
function slashGroups(page: SceneNode, prefix: string, components: SceneNode[]): StoryGroup[] {
  const derived = deriveSlashVariantProperties(components, () => '')
  if (!derived) return components.map((component) => componentGroup(page, component))
  const props = derived.definitions.map((def) => ({
    name: def.name,
    options: def.variantOptions ?? []
  }))
  const variants = components.map((component) => {
    const values = derived.variants.get(component.id)?.componentPropertyValues ?? {}
    return { values: props.map((prop) => values[prop.name] ?? ''), node: component }
  })
  return [
    distinctVariants({ page, title: `${page.name}/${prefix}`, name: prefix, props, variants })
  ]
}

/** The story files a page produces, in layer order. Instances are never exported. */
export function collectGroups(graph: SceneGraph, page: SceneNode): StoryGroup[] {
  const groups: StoryGroup[] = []
  const slashed = new Map<string, SceneNode[]>()
  const visit = (node: SceneNode) => {
    if (!isExported(node) || node.type === 'INSTANCE') return
    if (node.type === 'COMPONENT_SET') {
      const group = componentSetGroup(graph, page, node)
      if (group.variants.length > 0) groups.push(group)
      return
    }
    if (node.type === 'COMPONENT') {
      const [prefix, ...rest] = node.name.split('/')
      const name = prefix.trim()
      if (rest.length === 0 || !name) groups.push(componentGroup(page, node))
      else slashed.set(name, [...(slashed.get(name) ?? []), node])
      return
    }
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  for (const child of graph.getChildren(page.id)) visit(child)
  for (const [prefix, components] of slashed) groups.push(...slashGroups(page, prefix, components))
  return groups
}
