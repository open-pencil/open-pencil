import { uniqBy } from 'es-toolkit/array'
import { computed } from 'vue'

import { instanceExposureIssue, type ComponentPropertyType } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { groupComponentBindings } from './bindings'
import { instanceSwapOptions, swapOptionLabel } from './model'

const AUTHORED_TYPES = new Set<ComponentPropertyType>(['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'])

/** The selected main component's text, boolean and swap properties, and its nested instances. */
export function useComponentPropertyAuthoring() {
  const editor = useEditor()
  const context = useSceneComputed(() => {
    const selected = editor.getSelectedNodes()
    return selected.length === 1 ? editor.getComponentPropertyAuthoring(selected[0].id) : null
  })
  /** A set's variants may own properties of their own besides the shared ones. */
  const variants = useSceneComputed(() => {
    const owner = context.value?.owner
    return owner?.type === 'COMPONENT_SET'
      ? editor.graph.getChildren(owner.id).filter((node) => node.type === 'COMPONENT')
      : []
  })
  const owners = computed(() =>
    context.value?.node.type === 'COMPONENT_SET'
      ? [context.value.owner, ...variants.value]
      : (context.value?.owners ?? [])
  )
  const definitions = useSceneComputed(() =>
    owners.value.flatMap((owner) =>
      owner.componentPropertyDefinitions
        .filter((definition) => AUTHORED_TYPES.has(definition.type))
        .map((definition) => {
          const bindings = editor
            .getComponentPropertyBindings(owner.id, definition.id)
            .flatMap((binding) => {
              const node = editor.graph.getNode(binding.nodeId)
              return node ? [{ ...binding, node }] : []
            })
          return {
            ...definition,
            ownerId: owner.id,
            bindingGroups: groupComponentBindings(editor.graph, bindings)
          }
        })
    )
  )
  /** The set the selection belongs to, whose variant properties the list shows too. */
  const componentSet = computed(() =>
    context.value?.owner.type === 'COMPONENT_SET' ? context.value.owner : null
  )
  const variantProperties = useSceneComputed(() => {
    const set = componentSet.value
    if (!set) return []
    const used = editor.collectVariantOptions(set.id)
    return set.componentPropertyDefinitions
      .filter((definition) => definition.type === 'VARIANT')
      .map((definition) => ({
        id: definition.id,
        name: definition.name,
        values: editor.getVariantOptions(set.id, definition.id),
        used: [...(used.get(definition.name) ?? [])]
      }))
  })
  type VariantProperty = (typeof variantProperties.value)[number]
  type AuthoredProperty = (typeof definitions.value)[number]
  type PropertyRow =
    | { kind: 'variant'; id: string; variant: VariantProperty }
    | { kind: 'property'; id: string; property: AuthoredProperty }
  /** Every row of the list in the owner's order: variant properties and authored ones. */
  const rows = computed((): PropertyRow[] => {
    const owner = context.value?.owner
    if (!owner) return []
    const variantById = new Map(variantProperties.value.map((item) => [item.id, item]))
    const authoredById = new Map(definitions.value.map((item) => [item.id, item]))
    const ownRows = owner.componentPropertyDefinitions.flatMap((definition): PropertyRow[] => {
      const variant = variantById.get(definition.id)
      if (variant) return [{ kind: 'variant' as const, id: variant.id, variant }]
      const property = authoredById.get(definition.id)
      return property ? [{ kind: 'property' as const, id: property.id, property }] : []
    })
    // Properties a variant owns on its own come after the set's shared ones.
    const localRows = definitions.value
      .filter((item) => item.ownerId !== owner.id)
      .map((property) => ({ kind: 'property' as const, id: property.id, property }))
    return [...ownRows, ...localRows]
  })
  const conflicts = useSceneComputed(() => {
    const set = componentSet.value
    if (!set) return []
    return editor.getComponentSetVariantConflicts(set.id).map((conflict) => ({
      label: Object.entries(conflict.values)
        .map(([name, value]) => `${name}=${value}`)
        .join(', '),
      componentIds: conflict.componentIds
    }))
  })

  /** Figma names a new variant property Property 1, Property 2, … with the value Default. */
  function addVariantProperty() {
    const set = componentSet.value
    if (!set) return undefined
    const taken = new Set(set.componentPropertyDefinitions.map((definition) => definition.name))
    let index = 1
    while (taken.has(`Property ${index}`)) index++
    return editor.addPropertyDefinition(set.id, `Property ${index}`, 'VARIANT', 'Default')
  }

  function withSet<T>(run: (setId: string) => T): T | undefined {
    const set = componentSet.value
    return set ? run(set.id) : undefined
  }

  const components = useSceneComputed(() =>
    [...editor.graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')
  )
  /** Nested instances a component, or every variant of a set, can expose. */
  const nestedInstances = useSceneComputed(() => {
    const selected = context.value?.node
    if (!selected || (selected.type !== 'COMPONENT' && selected.type !== 'COMPONENT_SET')) return []
    const sources = selected.type === 'COMPONENT_SET' ? variants.value : [selected]
    return uniqBy(
      sources.flatMap((source) => editor.getExposableInstances(source.id)),
      (node) => node.id
    ).map((node) => ({
      id: node.id,
      name: node.name,
      exposed: node.isExposedInstance,
      available: !instanceExposureIssue(editor.graph, node)
    }))
  })

  /**
   * Components a swap property's default can show. A linked layer must not end up holding its own
   * component, and a property with no layers yet must still fit inside every owning component.
   */
  function swapOptions(propertyId: string) {
    const definition = definitions.value.find((item) => item.id === propertyId)
    const layerParents =
      definition?.bindingGroups.flatMap((group) =>
        group.bindings.flatMap((binding) => (binding.node.parentId ? [binding.node.parentId] : []))
      ) ?? []
    const owners = variants.value.length ? variants.value : (context.value?.owners ?? [])
    return instanceSwapOptions(
      editor.graph,
      components.value,
      definition ?? { id: '', name: '', type: 'INSTANCE_SWAP', defaultValue: '' },
      definition?.defaultValue ?? '',
      [
        ...layerParents,
        ...owners.filter((owner) => owner.type === 'COMPONENT').map((owner) => owner.id)
      ]
    )
  }

  return {
    context,
    definitions,
    rows,
    componentSet,
    conflicts,
    addVariantProperty,
    renameVariantProperty: (propertyId: string, name: string) =>
      withSet((setId) => editor.renamePropertyDefinition(setId, propertyId, name)),
    removeVariantProperty: (propertyId: string) =>
      withSet((setId) => editor.removePropertyDefinition(setId, propertyId)),
    renameVariantValue: (propertyId: string, previous: string, value: string) =>
      withSet((setId) => editor.renameVariantValue(setId, propertyId, previous, value)),
    reorderVariantValues: (propertyId: string, values: string[]) =>
      withSet((setId) => editor.reorderVariantValues(setId, propertyId, values)),
    addVariantValue: (propertyId: string, value: string) =>
      withSet((setId) => editor.addVariantValue(setId, propertyId, value)),
    removeVariantValue: (propertyId: string, value: string, replacement?: string) =>
      withSet((setId) => editor.removeVariantValue(setId, propertyId, value, replacement)),
    selectNodes: (nodeIds: string[]) => editor.select(nodeIds),
    nestedInstances,
    variantCount: computed(() => variants.value.length),
    editable: computed(() => !!context.value?.editable),
    swapOptions,
    componentName: (id: string) => {
      const node = editor.graph.getNode(id)
      return node ? swapOptionLabel(editor.graph, node) : id
    },
    create: editor.createComponentProperty,
    expose: editor.exposeComponentProperty,
    bind: editor.bindComponentProperty,
    rename: editor.renameComponentProperty,
    setDefault: editor.setComponentPropertyDefault,
    remove: editor.deleteComponentProperty,
    move: editor.moveComponentProperty,
    setExposed: editor.setInstanceExposed,
    selectOwner: () => {
      if (context.value) editor.select([context.value.owner.id])
    },
    select: (nodeId: string) => editor.select([nodeId])
  }
}
