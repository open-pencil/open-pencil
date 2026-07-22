<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  findFrameResizePreset,
  FRAME_RESIZE_PRESET_CATEGORIES,
  FRAME_RESIZE_PRESETS
} from '@/app/editor/frame-presets'
import AppGroupedSelect from '@/components/ui/AppGroupedSelect.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const store = useEditorStore()
const { selectedNode } = useSelectionState()
const { panels } = useI18n()

const selectedPreset = computed(() => {
  const node = selectedNode.value
  return node ? findFrameResizePreset(node.width, node.height, node.name) : undefined
})
const selectedPresetId = computed({
  get: () => selectedPreset.value?.id ?? 'custom',
  set: (id: string) => {
    const node = selectedNode.value
    const preset = FRAME_RESIZE_PRESETS.find((candidate) => candidate.id === id)
    if (node?.type === 'FRAME' && preset) store.resizeFrameToPreset(node.id, preset)
  }
})
const groups = computed(() =>
  FRAME_RESIZE_PRESET_CATEGORIES.map((category) => ({
    label: panels.value[category.labelKey],
    items: category.presets.map((preset) => ({ value: preset.id, label: preset.name }))
  }))
)
const displayValue = computed(() => selectedPreset.value?.name ?? panels.value.framePresetCustom)
const selectUI = {
  content: 'max-h-80',
  viewport: 'max-h-80'
}
</script>

<template>
  <PanelSection :label="panels.frame">
    <AppGroupedSelect
      v-model="selectedPresetId"
      data-property="frame-preset"
      :aria-label="panels.framePreset"
      :groups="groups"
      :display-value="displayValue"
      :ui="selectUI"
    />
  </PanelSection>
</template>
