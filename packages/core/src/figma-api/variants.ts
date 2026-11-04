import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { reapplyInstanceComponentProperties } from '#core/editor/components/properties'
import { applyVariantProperties, variantSetProps } from '#core/editor/components/variant-set'
import {
  appendPropertyDefinition,
  renameProperty
} from '#core/editor/components/variants/definitions'
import { refreshVariantOptions, setVariantValues } from '#core/editor/components/variants/history'
import {
  findExactVariant,
  getComponentSet,
  getVariantDefinitions,
  variantValues
} from '#core/editor/components/variants/model'
import { wrapNodes } from '#core/editor/structure/container-wrap'

// Variant edits through the Plugin API run the panel's own edits, with Figma's messages. Figma
// accepts renames that break a set (an axis named as another or left empty); those are refused.

interface VariantValue {
  definition: ComponentPropertyDefinition
  value: string | boolean
}

function requireDistinctComponents(graph: SceneGraph, nodeIds: ReadonlyArray<string>): SceneNode[] {
  if (nodeIds.length === 0) throw new Error('Need at least 1 component to combine as variants')
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new Error('combineAsVariants requires distinct COMPONENT nodes')
  }

  const nodes = nodeIds.map((id) => graph.getNode(id))
  if (!nodes.every((node): node is SceneNode => node?.type === 'COMPONENT')) {
    throw new Error('combineAsVariants requires COMPONENT nodes')
  }
  return nodes
}

export function combineComponentsAsVariants(
  graph: SceneGraph,
  nodeIds: ReadonlyArray<string>,
  parentId: string,
  index?: number
): SceneNode {
  const components = requireDistinctComponents(graph, nodeIds)
  const parent = graph.getNode(parentId)
  if (!parent) throw new Error('Parent node not found')

  // The plugin API wraps the variants exactly; see `variantSetProps`.
  const componentSet = wrapNodes(
    graph,
    'COMPONENT_SET',
    components,
    parentId,
    index,
    variantSetProps(graph, components, parentId, 'script')
  )
  applyVariantProperties(graph, components, componentSet.id)

  return componentSet
}

/**
 * Switches an instance to the variant with the given values, the rest kept, as Figma's
 * `setProperties` does; a combination no variant has fails without changing anything.
 */
export function switchVariant(
  scene: SceneGraph,
  instance: SceneNode,
  values: VariantValue[]
): void {
  const component = instance.componentId ? scene.getNode(instance.componentId) : undefined
  const setId = component?.parentId
  const target =
    component && setId && getComponentSet(scene, setId)
      ? findExactVariant(scene, setId, {
          ...variantValues(scene, setId, component),
          ...Object.fromEntries(
            values.map(({ definition, value }) => [definition.name, String(value)])
          )
        })
      : undefined
  if (!target)
    throw new Error('in setProperties: Unable to find a variant with those property values')
  if (target.id === instance.componentId) return
  scene.swapInstanceComponent(instance.id, target.id)
  reapplyInstanceComponentProperties({ graph: scene }, instance.id)
}

function assertAxisNameFree(set: SceneNode, method: string, name: string, self?: string): void {
  const taken = set.componentPropertyDefinitions.some(
    (definition) =>
      definition.id !== self && definition.type === 'VARIANT' && definition.name === name
  )
  if (taken) throw new Error(`in ${method}: Node already has a variant property with name ${name}`)
}

/** Adds a variant axis to a set, appending its value to every variant's name, as Figma does. */
export function addVariantAxis(
  scene: SceneGraph,
  node: SceneNode,
  name: string,
  defaultValue: string
): ComponentPropertyDefinition {
  if (node.type !== 'COMPONENT_SET')
    throw new Error('in addComponentProperty: Can only add variant property to a component set')
  if (defaultValue.trim() === '')
    throw new Error('in addComponentProperty: Component property default value cannot be empty')
  assertAxisNameFree(node, 'addComponentProperty', name)
  const id = appendPropertyDefinition(scene, node.id, name, 'VARIANT', defaultValue.trim())
  const definition = getVariantDefinitions(scene, node.id).find((item) => item.id === id)
  if (!definition) throw new Error(`in addComponentProperty: Could not add ${name}`)
  return definition
}

/**
 * Edits a variant axis: a new name renames it in every variant's name, which instances follow,
 * as Figma does. Its default comes from the default variant, so it cannot be set.
 */
export function editVariantAxis(
  scene: SceneGraph,
  node: SceneNode,
  definition: ComponentPropertyDefinition,
  changes: { name?: string; defaultValue?: string | boolean }
): string {
  if (changes.defaultValue !== undefined)
    throw new Error('in editComponentProperty: Cannot change defaultValue of a variant property')
  const name = changes.name?.trim()
  if (name === undefined) return definition.name
  if (name === '') throw new Error('Property name must not be empty')
  assertAxisNameFree(node, 'editComponentProperty', name, definition.id)
  if (name !== definition.name) renameProperty(scene, node.id, definition.id, name)
  return name
}

/**
 * A variant's values, or an instance's of one, by axis in the set's order; null for anything
 * that is not a variant.
 */
export function variantPropertiesOf(
  scene: SceneGraph,
  node: SceneNode
): Record<string, string> | null {
  const variant =
    node.type === 'INSTANCE' && node.componentId ? scene.getNode(node.componentId) : node
  const setId = variant?.type === 'COMPONENT' ? variant.parentId : undefined
  if (!variant || !setId || !getComponentSet(scene, setId)) return null
  return variantValues(scene, setId, variant)
}

/**
 * Takes a renamed variant's values from its name, as Figma does, and lets the set's value lists
 * follow: values no variant uses drop out. A name that does not name exactly the set's axes,
 * or names another variant's values, changes no values, as Figma leaves such a set in error.
 */
export function syncVariantName(scene: SceneGraph, node: SceneNode): void {
  const setId = node.type === 'COMPONENT' ? node.parentId : undefined
  if (!setId || !getComponentSet(scene, setId)) return
  const axes = getVariantDefinitions(scene, setId).map((definition) => definition.name)
  const parsed = parseVariantName(node.name)
  const names = Object.keys(parsed)
  if (names.length !== axes.length || !axes.every((axis) => parsed[axis]?.trim())) return
  const values = { ...node.componentPropertyValues, ...parsed }
  // Values another variant has already leave the set in error in Figma; these stay too.
  const twin = findExactVariant(scene, setId, values)
  if (twin && twin.id !== node.id) return
  setVariantValues(scene, setId, node.id, values)
  refreshVariantOptions(scene, setId, { dropUnused: true })
}
