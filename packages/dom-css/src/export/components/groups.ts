import type { StateElement } from '#dom-css/behaviours/states/types'

import {
  behaviourOwner,
  findLayerByPath,
  instanceMainComponent,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { ComponentModel } from './model'
import { placementOnly, referenceValues, type UsedLayer } from './references'
import { slugValues, textOf, type ChoiceModel } from './repeats'

/** Groups whose items are their own primitive inside the group, as Reka and Radix have them. */
export const GROUP_ITEMS = {
  radioGroup: 'radioGroupItem',
  toggleGroup: 'toggleGroupItem',
  accordion: 'accordionItem'
} as const

export type GroupKind = keyof typeof GROUP_ITEMS
export type ItemKind = (typeof GROUP_ITEMS)[GroupKind]

export const isGroup = (kind: string): kind is GroupKind => Object.hasOwn(GROUP_ITEMS, kind)

/** Builds the component of a group's items, named for the group. */
export type ItemBuilder = (owner: SceneNode) => ComponentModel | null

/**
 * A group's items: the component they share, generated as the group's item primitive, and
 * each item in the items slot as a use of it with the value it stands for. The group chooses
 * among those values, starting on the item the design draws on, or none.
 */
export function groupItems(
  graph: SceneGraph,
  variantIds: readonly string[],
  itemsElement: StateElement | undefined,
  build: ItemBuilder
): { item: ComponentModel; used: Map<StateElement, UsedLayer>; choice: ChoiceModel } | null {
  const elements = (itemsElement?.children ?? []).filter(
    (child): child is StateElement => child.type === 'element'
  )
  const instances = elements.map((element) => {
    const path = element.key.split('\0')[0] ?? ''
    const node = variantIds
      .map((id) => findLayerByPath(graph, id, path))
      .find((found) => found?.type === 'INSTANCE')
    const main = node && instanceMainComponent(graph, node)
    return node && main ? { node, owner: behaviourOwner(graph, main) } : null
  })
  const owner = instances.find((instance) => instance?.owner)?.owner
  const item = owner && build(owner)
  if (!owner || !item) return null

  // An item is named by its label property when it has one, else by the words it reads.
  const label = item.texts.at(0)
  const values = slugValues(
    elements.map((element, index) => {
      const assigned = label && instances[index]?.node.componentPropertyAssignments[label.id]
      return typeof assigned === 'string' ? assigned : textOf(element)
    })
  )
  const used = new Map<StateElement, UsedLayer>()
  let chosen: string | null = null
  for (const [index, element] of elements.entries()) {
    const instance = instances[index]
    const value = values.at(index)
    if (instance?.owner?.id !== owner.id || value === undefined) continue
    const { props, model } = referenceValues(graph, instance.node, item)
    if (model) chosen ??= value
    used.set(element, {
      type: 'reference',
      component: item.name,
      props: [{ name: 'value', value }, ...props],
      model: null
    })
    element.children = []
    placementOnly(element)
  }
  return { item, used, choice: { options: values, default: chosen } }
}
