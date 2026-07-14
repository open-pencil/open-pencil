<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import { useEditorStore } from '@/app/editor/active-store'

const editor = useEditorStore()
const { selectedNode: node } = useSelectionState()
const { panels } = useI18n()

const instanceComponent = computed(() => {
  if (!node.value || node.value.type !== 'INSTANCE' || !node.value.componentId) return null
  return editor.graph.getNode(node.value.componentId) ?? null
})

const componentSetId = computed(() => {
  const comp = instanceComponent.value
  if (!comp) return null
  const parent = comp.parentId ? editor.graph.getNode(comp.parentId) : null
  return parent?.type === 'COMPONENT_SET' ? parent.id : null
})

const variantOptions = computed(() => {
  const csId = componentSetId.value
  if (!csId) return new Map<string, Set<string>>()
  return editor.collectVariantOptions(csId)
})

const currentValues = computed(() => {
  return instanceComponent.value?.componentPropertyValues ?? {}
})

const hasVariants = computed(() => variantOptions.value.size > 0)

function switchVariant(propertyName: string, newValue: string) {
  if (!node.value) return
  editor.switchInstanceVariant(node.value.id, propertyName, newValue)
}
</script>

<template>
  <PanelSection v-if="hasVariants" :label="panels.variants" :ui="{ title: 'text-component' }">
    <div class="flex flex-col gap-panel">
      <PanelFieldGroup
        v-for="[propName, options] in variantOptions"
        :key="propName"
        :label="propName"
      >
        <AppSelect
          :label="propName"
          :model-value="currentValues[propName] ?? ''"
          :options="[...options].map((value) => ({ value, label: value }))"
          :data-property="propName"
          @update:model-value="switchVariant(propName, $event)"
        />
      </PanelFieldGroup>
    </div>
  </PanelSection>
</template>
