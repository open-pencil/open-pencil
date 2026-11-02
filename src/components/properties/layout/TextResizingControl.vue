<script setup lang="ts">
import { computed } from 'vue'

import { MIXED } from '@open-pencil/vue/controls/node-props'
import { useSelectionLayout, type TextResizeMode } from '@open-pencil/vue/controls/selection-layout'
import { useI18n } from '@open-pencil/vue/i18n'

import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const layout = useSelectionLayout()
const { panels } = useI18n()

// Texts resizing differently leave every option off.
const mode = computed(() => {
  const value = layout.textResize.value
  return value === MIXED || value === undefined ? '' : value
})

const options = computed(() => [
  { value: 'AUTO_WIDTH' as const, label: panels.value.resizeAutoWidth },
  { value: 'AUTO_HEIGHT' as const, label: panels.value.resizeAutoHeight },
  { value: 'FIXED' as const, label: panels.value.resizeFixed }
])
</script>

<template>
  <PanelFieldGroup :label="panels.resizing" class="mb-3">
    <SegmentedControl
      :model-value="mode"
      :options="options"
      :label="panels.resizing"
      @change="layout.setTextResize($event as TextResizeMode)"
    >
      <template #option="{ option }">
        <Tip :label="option.label">
          <span class="flex items-center justify-center">
            <icon-lucide-move-horizontal v-if="option.value === 'AUTO_WIDTH'" class="size-3.5" />
            <icon-lucide-wrap-text v-else-if="option.value === 'AUTO_HEIGHT'" class="size-3.5" />
            <icon-lucide-lock v-else class="size-3.5" />
          </span>
        </Tip>
      </template>
    </SegmentedControl>
  </PanelFieldGroup>
</template>
