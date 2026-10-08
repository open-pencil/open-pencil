import { uniqBy } from 'es-toolkit/array'
import { computed } from 'vue'

import {
  canCreateInstance,
  instanceExposureIssue,
  type ComponentPropertyType,
  type SceneNode
} from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { groupComponentBindings } from './bindings'

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

  /** Components a swap property can show, without one that would contain itself. */
  function swapOptions(propertyId: string) {
    const layers =
      definitions.value
        .find((item) => item.id === propertyId)
        ?.bindingGroups.flatMap((group) => group.bindings.map((binding) => binding.node)) ?? []
    return components.value.map((node) => ({
      value: node.id,
      label: node.name,
      disabled: layers.some(
        (layer: SceneNode) =>
          !!layer.parentId && !canCreateInstance(editor.graph, node.id, layer.parentId)
      )
    }))
  }

  return {
    context,
    definitions,
    nestedInstances,
    variantCount: computed(() => variants.value.length),
    editable: computed(() => !!context.value?.editable),
    swapOptions,
    componentName: (id: string) => components.value.find((node) => node.id === id)?.name ?? id,
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
