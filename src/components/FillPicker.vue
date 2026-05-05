<script setup lang="ts">
import { twMerge } from 'tailwind-merge'

import { applySolidFillColor, FillPickerRoot, useI18n } from '@open-pencil/vue'

import GradientEditor from './GradientEditor.vue'
import ColorPickerPanel from '@/components/ColorPickerPanel/ColorPickerPanel.vue'
import ImageFillPicker from './ImageFillPicker.vue'
import Tip from './ui/Tip.vue'
import { usePopoverUI } from './ui/popover'

import type { Fill } from '@open-pencil/core/scene-graph'
import type { OkHCLControls } from '@open-pencil/vue'

const TAB_BASE =
  'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors'

function tabClass(active: boolean) {
  return twMerge(
    TAB_BASE,
    active ? 'bg-hover text-surface' : 'text-muted hover:bg-hover hover:text-surface'
  )
}

const {
  fill,
  okhcl = null,
  swatchBackground
} = defineProps<{
  fill: Fill
  okhcl?: OkHCLControls | null
  swatchBackground?: string
}>()
const emit = defineEmits<{ update: [fill: Fill] }>()
const cls = usePopoverUI({ content: 'w-60 p-2' })
const { panels } = useI18n()
</script>

<template>
  <FillPickerRoot
    :fill="fill"
    :ui="{
      content: cls.content,
      swatch: 'size-5 shrink-0 cursor-pointer rounded border border-border p-0'
    }"
    @update="emit('update', $event)"
  >
    <template #trigger="{ style }">
      <button
        data-test-id="fill-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ ...style, background: swatchBackground ?? style.background }"
      />
    </template>
    <template #default="{ fill: currentFill, category, toSolid, toGradient, toImage }">
      <div class="mb-2 flex items-center gap-0.5">
        <Tip :label="panels.solid">
          <button
            :class="tabClass(category === 'SOLID')"
            data-test-id="fill-picker-tab-solid"
            @click="toSolid"
          >
            <icon-lucide-square class="size-3.5" />
          </button>
        </Tip>
        <Tip :label="panels.linearGradient">
          <button
            :class="tabClass(category === 'GRADIENT')"
            data-test-id="fill-picker-tab-gradient"
            @click="toGradient"
          >
            <icon-lucide-blend class="size-3.5" />
          </button>
        </Tip>
        <Tip :label="panels.image">
          <button
            :class="tabClass(category === 'IMAGE')"
            data-test-id="fill-picker-tab-image"
            @click="toImage"
          >
            <icon-lucide-image class="size-3.5" />
          </button>
        </Tip>
      </div>

      <ColorPickerPanel
        v-if="category === 'SOLID'"
        :color="currentFill.color"
        :okhcl="okhcl"
        @update="emit('update', applySolidFillColor(currentFill, $event))"
      />

      <GradientEditor
        v-if="category === 'GRADIENT'"
        :fill="currentFill"
        @update="emit('update', $event)"
      />

      <ImageFillPicker
        v-if="category === 'IMAGE'"
        :fill="currentFill"
        @update="emit('update', $event)"
      />
    </template>
  </FillPickerRoot>
</template>
