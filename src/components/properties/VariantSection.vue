<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import { useSectionUI } from '@/components/ui/section'
import { useEditorStore } from '@/app/editor/active-store'

const editor = useEditorStore()
const { selectedNode: node } = useSelectionState()
const sectionCls = useSectionUI()
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
  <div v-if="hasVariants" data-test-id="variant-section" :class="sectionCls.wrapper">
    <label class="mb-1.5 block text-[11px] font-medium text-component">{{ panels.variants }}</label>
    <div class="flex flex-col gap-1.5">
      <div
        v-for="[propName, options] in variantOptions"
        :key="propName"
        class="flex flex-col gap-0.5"
      >
        <label class="text-[10px] text-muted">{{ propName }}</label>
        <AppSelect
          :model-value="currentValues[propName] ?? ''"
          :options="[...options].map((v) => ({ value: v, label: v }))"
          @update:model-value="switchVariant(propName, $event)"
        />
      </div>
    </div>
  </div>
</template>
