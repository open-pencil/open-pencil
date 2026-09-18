import { computed, watch } from 'vue'

import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import {
  compatibleComponentPropertyDefinitions,
  instanceSwapOptions,
  mergedComponentPropertyValue,
  variantOptions,
  type ComponentPropertyControl,
  type ComponentPropertyOption
} from '#vue/controls/component-props/model'
import { MIXED } from '#vue/controls/node-props/helpers'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useRetainedActivity } from '#vue/lifecycle/retention/context'

interface ResolvedEdit {
  definition: ComponentPropertyDefinition
  targets: SceneNode[]
  label: string
}

/** One batch per property and target set, so a new selection starts a new entry. */
function batchKey(propertyId: string, targets: SceneNode[]): string {
  return [propertyId, ...targets.map((node) => node.id)].join(':')
}

export function useComponentProperties() {
  const editor = useEditor()
  const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)
  const retainedActivity = useRetainedActivity()
  // A batch never spans a page change, a new selection, or a paused retained scope.
  watch([() => editor.state.currentPageId, () => editor.state.selectedIds], batch.flush, {
    flush: 'sync'
  })
  if (retainedActivity) {
    watch(
      retainedActivity,
      (active) => {
        if (!active) batch.flush()
      },
      { flush: 'sync' }
    )
  }
  const instances = useSceneComputed(() =>
    editor.getSelectedNodes().filter((node) => node.type === 'INSTANCE')
  )
  const selectedCount = computed(() => editor.state.selectedIds.size)
  const allSelectedAreInstances = computed(
    () => instances.value.length > 0 && instances.value.length === selectedCount.value
  )
  const definitionSets = useSceneComputed(() =>
    instances.value.map((instance) => editor.getInstanceComponentPropertyDefinitions(instance.id))
  )
  const definitions = computed(() => compatibleComponentPropertyDefinitions(definitionSets.value))
  const active = computed(() => allSelectedAreInstances.value && definitions.value.length > 0)
  const controls = useSceneComputed<ComponentPropertyControl[]>(() => {
    if (!active.value || instances.value.length === 0) return []
    const firstInstance = instances.value[0]
    // Swap options scan the graph, so resolve that list once for every swap control.
    let componentNodes: SceneNode[] | null = null
    return definitions.value.map((definition) => {
      const values = instances.value.map((instance) =>
        editor.getInstanceComponentPropertyValue(instance.id, definition)
      )
      const value = mergedComponentPropertyValue(values)
      let options: ComponentPropertyOption[] = []
      if (definition.type === 'VARIANT') {
        options = variantOptions(editor, firstInstance, definition.name)
      } else if (definition.type === 'INSTANCE_SWAP') {
        componentNodes ??= [...editor.graph.getAllNodes()]
        options = instanceSwapOptions(componentNodes, definition, value === MIXED ? '' : value)
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

  function resolveEdit(propertyId: string): ResolvedEdit | null {
    if (!active.value) return null
    const definition = definitions.value.find((item) => item.id === propertyId)
    if (!definition) return null
    return { definition, targets: [...instances.value], label: `Change ${definition.name}` }
  }

  function commitToInstances(edit: ResolvedEdit, propertyId: string, value: string) {
    const apply = () => {
      for (const instance of edit.targets) {
        editor.setInstanceComponentProperty(instance.id, propertyId, value)
      }
    }
    if (edit.targets.length > 1) editor.undo.runBatch(edit.label, apply)
    else apply()
  }

  function applyDiscrete(edit: ResolvedEdit, propertyId: string, value: string) {
    batch.flush()
    commitToInstances(edit, propertyId, value)
  }

  function hasValueEverywhere(edit: ResolvedEdit, value: string): boolean {
    return edit.targets.every(
      (instance) => editor.getInstanceComponentPropertyValue(instance.id, edit.definition) === value
    )
  }

  function setValue(propertyId: string, value: string) {
    const edit = resolveEdit(propertyId)
    if (edit) applyDiscrete(edit, propertyId, value)
  }

  /** Apply typing immediately, grouping rapid changes until blur, Enter, or idle. */
  function setTextValue(propertyId: string, value: string) {
    const edit = resolveEdit(propertyId)
    if (!edit) return
    if (edit.definition.type !== 'TEXT') {
      applyDiscrete(edit, propertyId, value)
      return
    }
    if (hasValueEverywhere(edit, value)) return
    batch.ensure(batchKey(propertyId, edit.targets), edit.label)
    commitToInstances(edit, propertyId, value)
  }

  return { active, controls, setValue, setTextValue, flush: batch.flush }
}
