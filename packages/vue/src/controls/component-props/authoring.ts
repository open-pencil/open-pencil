import { computed } from 'vue'

import type { VariantConflict } from '@open-pencil/core/editor'
import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

export interface VariantDefinitionControl {
  id: string
  name: string
  values: string[]
}

function variantContext(node: SceneNode | null, graph: ReturnType<typeof useEditor>['graph']) {
  if (node?.type === 'COMPONENT_SET') return { componentSet: node, variant: null }
  if (node?.type !== 'COMPONENT' || !node.parentId) return null
  const parent = graph.getNode(node.parentId)
  return parent?.type === 'COMPONENT_SET' ? { componentSet: parent, variant: node } : null
}

export function useVariantAuthoring() {
  const editor = useEditor()
  const context = useSceneComputed(() => {
    void editor.state.sceneVersion
    const selected = editor.getSelectedNodes()
    return selected.length === 1 ? variantContext(selected[0] ?? null, editor.graph) : null
  })
  const active = computed(() => context.value !== null)
  const componentSet = computed(() => context.value?.componentSet ?? null)
  const variant = computed(() => context.value?.variant ?? null)
  const definitions = useSceneComputed<VariantDefinitionControl[]>(() => {
    void editor.state.sceneVersion
    const componentSetId = componentSet.value?.id
    if (!componentSetId) return []
    const values = editor.collectVariantOptions(componentSetId)
    return editor
      .getComponentSetPropertyDefs(componentSetId)
      .filter(
        (definition): definition is ComponentPropertyDefinition => definition.type === 'VARIANT'
      )
      .map((definition) => ({
        id: definition.id,
        name: definition.name,
        values: [...(values.get(definition.name) ?? [])]
      }))
  })
  const diagnostics = useSceneComputed<VariantConflict[]>(() => {
    void editor.state.sceneVersion
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.getComponentSetVariantConflicts(componentSetId) : []
  })

  function addProperty(name: string, initialValue: string) {
    const componentSetId = componentSet.value?.id
    if (componentSetId) editor.addPropertyDefinition(componentSetId, name, 'VARIANT', initialValue)
  }

  function renameProperty(propertyId: string, name: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId
      ? editor.renamePropertyDefinition(componentSetId, propertyId, name)
      : false
  }

  function removeProperty(propertyId: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.removePropertyDefinition(componentSetId, propertyId) : false
  }

  function reorderProperties(propertyIds: string[]) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.reorderPropertyDefinitions(componentSetId, propertyIds) : false
  }

  function renameValue(propertyId: string, previousValue: string, value: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId
      ? editor.renameVariantValue(componentSetId, propertyId, previousValue, value)
      : false
  }

  function reorderValues(propertyId: string, values: string[]) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.reorderVariantValues(componentSetId, propertyId, values) : false
  }

  function setVariantValue(propertyId: string, value: string) {
    const variantId = variant.value?.id
    return variantId
      ? editor.setVariantPropertyValue(variantId, propertyId, value)
      : { kind: 'invalid' as const }
  }

  function addVariant() {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.addVariant(componentSetId) : undefined
  }

  function duplicateVariant() {
    const source =
      variant.value ?? editor.getDefaultVariantForComponentSet(componentSet.value?.id ?? '')
    return source ? editor.duplicateVariant(source.id) : undefined
  }

  function removeVariant() {
    return variant.value ? editor.removeVariant(variant.value.id) : false
  }

  return {
    active,
    componentSet,
    variant,
    definitions,
    diagnostics,
    addProperty,
    renameProperty,
    removeProperty,
    reorderProperties,
    renameValue,
    reorderValues,
    setVariantValue,
    addVariant,
    duplicateVariant,
    removeVariant
  }
}
