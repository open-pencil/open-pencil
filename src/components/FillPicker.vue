<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { twMerge } from 'tailwind-merge'

import GradientEditor from './GradientEditor.vue'
import HsvColorArea from './HsvColorArea.vue'
import ImageFillPicker from './ImageFillPicker.vue'
import { useFillPicker } from '@open-pencil/vue'

import Tip from './Tip.vue'

import type { Fill } from '@open-pencil/core'

const TAB_BASE =
  'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors'

function tabClass(active: boolean) {
  return twMerge(
    TAB_BASE,
    active ? 'bg-hover text-surface' : 'text-muted hover:bg-hover hover:text-surface'
  )
}

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const { category, swatchBg, toSolid, toGradient, toImage } = useFillPicker(
  computed(() => fill),
  (updated) => emit('update', updated)
)
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        data-test-id="fill-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ background: swatchBg }"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="z-[100] w-60 rounded-lg border border-border bg-panel p-2 shadow-xl"
        :side-offset="4"
        side="left"
      >
        <div class="mb-2 flex items-center gap-0.5">
          <Tip label="Solid">
            <button
              :class="tabClass(category === 'SOLID')"
              data-test-id="fill-picker-tab-solid"
              @click="toSolid"
            >
              <icon-lucide-square class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Gradient">
            <button
              :class="tabClass(category === 'GRADIENT')"
              data-test-id="fill-picker-tab-gradient"
              @click="toGradient"
            >
              <icon-lucide-blend class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Image">
            <button
              :class="tabClass(category === 'IMAGE')"
              data-test-id="fill-picker-tab-image"
              @click="toImage"
            >
              <icon-lucide-image class="size-3.5" />
            </button>
          </Tip>
        </div>

        <HsvColorArea
          v-if="category === 'SOLID'"
          :color="fill.color"
          @update="emit('update', { ...fill, color: $event })"
        />

        <GradientEditor
          v-if="category === 'GRADIENT'"
          :fill="fill"
          @update="emit('update', $event)"
        />

        <ImageFillPicker
          v-if="category === 'IMAGE'"
          :fill="fill"
          @update="emit('update', $event)"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
