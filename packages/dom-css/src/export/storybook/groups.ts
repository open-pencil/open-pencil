import { behaviourArgs } from '#dom-css/behaviours/args'
import { uniq } from 'es-toolkit/array'

import { restingVariant, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import type { StoryProp } from './module'
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
  props: StoryProp[]
  variants: StoryVariant[]
  /** Layer the story file links to, when the group has a layer of its own. */
  linkNode?: string
  /**
   * The component set or standalone component the group shows, which may generate a component
   * of its own; slash-named components grouped together have none.
   */
  set?: SceneNode
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

function componentSetGroup(
  graph: SceneGraph,
  page: SceneNode,
  section: string,
  set: SceneNode
): StoryGroup {
  const definitions = set.componentPropertyDefinitions.filter((def) => def.type === 'VARIANT')
  // The variant at its default values opens the file as its Default story.
  const first = restingVariant(graph, set)
  const components = graph
    .getChildren(set.id)
    .filter((child) => child.type === 'COMPONENT' && isExported(child))
  const variants = [
    ...components.filter((component) => component === first),
    ...components.filter((component) => component !== first)
  ].map((component) => ({
    values: definitions.map((def) => component.componentPropertyValues[def.name] ?? ''),
    node: component
  }))
  const args = behaviourArgs(graph, set)
  const props = definitions.map((def, index): StoryProp => {
    const options = uniq([
      ...(def.variantOptions ?? []),
      ...variants.map((v) => v.values[index] ?? '')
    ])
    const boolean = args?.booleans.get(def.name)
    if (boolean) return { name: def.name, options, control: { type: 'boolean', ...boolean } }
    if (args?.states?.property === def.name)
      return {
        name: def.name,
        options,
        control: { type: 'state', rest: args.states.rest, disabled: args.states.disabled }
      }
    return { name: def.name, options }
  })
  return distinctVariants({
    page,
    title: `${section}/${set.name}`,
    name: set.name,
    props,
    variants,
    linkNode: set.name,
    set
  })
}

function componentGroup(page: SceneNode, section: string, component: SceneNode): StoryGroup {
  return {
    page,
    title: `${section}/${component.name}`,
    name: component.name,
    props: [],
    variants: [{ values: [], node: component }],
    linkNode: component.name,
    // A standalone component generates a component of its own too, as a set does.
    set: component
  }
}

/** `Button/Primary`, `Button/Secondary` → one `Button` group with a derived variant property. */
function slashGroups(
  page: SceneNode,
  section: string,
  prefix: string,
  components: SceneNode[]
): StoryGroup[] {
  const derived = deriveSlashVariantProperties(components, () => '')
  if (!derived) return components.map((component) => componentGroup(page, section, component))
  const props = derived.definitions.map((def) => ({
    name: def.name,
    options: def.variantOptions ?? []
  }))
  const variants = components.map((component) => {
    const values = derived.variants.get(component.id)?.componentPropertyValues ?? {}
    return { values: props.map((prop) => values[prop.name] ?? ''), node: component }
  })
  return [distinctVariants({ page, title: `${section}/${prefix}`, name: prefix, props, variants })]
}

/**
 * The story files a page produces, in layer order, titled under `section`, the page's name by
 * default. Instances are never exported.
 */
export function collectGroups(
  graph: SceneGraph,
  page: SceneNode,
  section = page.name
): StoryGroup[] {
  const groups: StoryGroup[] = []
  const slashed = new Map<string, SceneNode[]>()
  const visit = (node: SceneNode) => {
    if (!isExported(node) || node.type === 'INSTANCE') return
    if (node.type === 'COMPONENT_SET') {
      const group = componentSetGroup(graph, page, section, node)
      if (group.variants.length > 0) groups.push(group)
      return
    }
    if (node.type === 'COMPONENT') {
      const [prefix, ...rest] = node.name.split('/')
      const name = prefix.trim()
      if (rest.length === 0 || !name) groups.push(componentGroup(page, section, node))
      else slashed.set(name, [...(slashed.get(name) ?? []), node])
      return
    }
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  for (const child of graph.getChildren(page.id)) visit(child)
  for (const [prefix, components] of slashed)
    groups.push(...slashGroups(page, section, prefix, components))
  return groups
}
