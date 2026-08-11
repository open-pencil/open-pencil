import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import {
  compatibleComponentPropertyDefinitions,
  instanceSwapOptions,
  mergedComponentPropertyValue,
  type ComponentPropertyControl,
  type ComponentPropertyOption
} from '#vue/controls/component-props/model'
import { MIXED } from '#vue/controls/node-props/helpers'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

function variantOptions(editor: ReturnType<typeof useEditor>, instance: SceneNode, name: string) {
  return editor.getVariantOptionAvailability(instance.id, name).map(({ value, available }) => ({
    value,
    label: value,
    disabled: !available
  }))
}

export function useComponentProperties() {
  const editor = useEditor()
  const instances = useSceneComputed(() => {
    void editor.state.sceneVersion
    return editor.getSelectedNodes().filter((node) => node.type === 'INSTANCE')
  })
  const selectedCount = computed(() => editor.state.selectedIds.size)
  const definitionSets = useSceneComputed(() => {
    void editor.state.sceneVersion
    return instances.value.map((instance) =>
      editor.getInstanceComponentPropertyDefinitions(instance.id)
    )
  })
  const definitions = computed(() => compatibleComponentPropertyDefinitions(definitionSets.value))
  const active = computed(
    () =>
      instances.value.length > 0 &&
      instances.value.length === selectedCount.value &&
      definitions.value.length > 0
  )
  const controls = useSceneComputed<ComponentPropertyControl[]>(() => {
    void editor.state.sceneVersion
    if (!active.value || instances.value.length === 0) return []
    const firstInstance = instances.value[0]
    return definitions.value.map((definition) => {
      const values = instances.value.map((instance) =>
        editor.getInstanceComponentPropertyValue(instance.id, definition)
      )
      const value = mergedComponentPropertyValue(values)
      let options: ComponentPropertyOption[] = []
      if (definition.type === 'VARIANT') {
        options = variantOptions(editor, firstInstance, definition.name)
      } else if (definition.type === 'INSTANCE_SWAP') {
        options = instanceSwapOptions(
          [...editor.graph.getAllNodes()],
          definition,
          value === MIXED ? '' : value
        )
      }
      return {
        id: definition.id,
        name: definition.name,
        type: definition.type,
        value,
        options
      }
    })
  })

  function setValue(propertyId: string, value: string) {
    if (!active.value) return
    const targets = [...instances.value]
    const definition = definitions.value.find((item) => item.id === propertyId)
    if (!definition) return
    const label = `Change ${definition.name}`
    const run = () => {
      for (const instance of targets) {
        editor.setInstanceComponentProperty(instance.id, propertyId, value)
      }
    }
    if (targets.length > 1) editor.undo.runBatch(label, run)
    else run()
  }

  return { active, controls, setValue }
}
