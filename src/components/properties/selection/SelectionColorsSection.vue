<script setup lang="ts">
import type { Color, Fill } from '@open-pencil/scene-graph'
import { useI18n, useSelectionColors } from '@open-pencil/vue'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/** Figma's Selection colors: each colour in the selection, recoloured everywhere it is used. */
const selection = useSelectionColors()
const { panels } = useI18n()

function swatch(color: Color, opacity: number): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

function onPickerOpenChange(open: boolean) {
  if (open) selection.begin()
  else selection.finish()
}
</script>

<template>
  <PanelSection
    v-if="selection.shown.value"
    :label="panels.selectionColors"
    data-test-id="selection-colors"
  >
    <div class="flex flex-col gap-1.5">
      <PaintField
        v-for="(entry, index) in selection.colors.value"
        :key="index"
        :opacity="entry.opacity"
        :opacity-label="panels.opacity"
        @update:opacity="selection.replace(index, { color: entry.color, opacity: $event })"
      >
        <template #preview>
          <ColorPicker
            :color="entry.color"
            @update="
              selection.replace(index, { color: { ...$event, a: 1 }, opacity: entry.opacity })
            "
            @open-change="onPickerOpenChange"
          >
            <template #trigger>
              <button
                type="button"
                :aria-label="panels.selectionColors"
                class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              >
                <FillSwatch :fill="swatch(entry.color, entry.opacity)" class="size-full" />
              </button>
            </template>
          </ColorPicker>
        </template>
        <template #value>
          <PaintValue
            :color="entry.color"
            :label="panels.selectionColors"
            @update="
              selection.replace(index, { color: { ...$event, a: 1 }, opacity: entry.opacity })
            "
          />
        </template>
      </PaintField>
    </div>
  </PanelSection>
</template>
