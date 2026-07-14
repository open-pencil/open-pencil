<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import { useEditorStore } from '@/app/editor/active-store'

import type { Color, Fill } from '@open-pencil/scene-graph'

const editor = useEditorStore()
const pageColor = computed(() => editor.state.pageColor)
const pageFill = computed<Fill>(() => ({
  type: 'SOLID',
  color: pageColor.value,
  opacity: 1,
  visible: true
}))
const { panels } = useI18n()

function updatePageAlpha(alpha: number) {
  editor.setPageColor({ ...pageColor.value, a: alpha })
}

function updatePageColor(color: Color) {
  editor.setPageColor(color)
}
</script>

<template>
  <PanelSection :label="panels.page">
    <PaintField
      :opacity="pageColor.a"
      :opacity-label="panels.opacity"
      @update:opacity="updatePageAlpha"
    >
      <template #preview>
        <ColorPicker :color="pageColor" @update="updatePageColor">
          <template #trigger>
            <button
              type="button"
              :aria-label="panels.pageBackground"
              class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            >
              <FillSwatch :fill="pageFill" class="size-full" />
            </button>
          </template>
        </ColorPicker>
      </template>
      <template #value>
        <PaintValue :color="pageColor" :label="panels.pageBackground" @update="updatePageColor" />
      </template>
    </PaintField>
  </PanelSection>
</template>
