<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

import { IMAGE_ADJUSTMENT_KEYS, type ImageAdjustments } from '@lawha/scene-graph'
import { usePhotoMessages } from '@lawha/vue/i18n'

const { adjustments } = defineProps<{ adjustments: ImageAdjustments | undefined }>()
const emit = defineEmits<{ update: [adjustments: ImageAdjustments | undefined] }>()

const t = usePhotoMessages()

type Key = (typeof IMAGE_ADJUSTMENT_KEYS)[number]

/** Sliders show −100…100; the fill stores −1…1. */
const percent = (key: Key) => Math.round((adjustments?.[key] ?? 0) * 100)

const edited = computed(
  () =>
    !!adjustments?.invert || IMAGE_ADJUSTMENT_KEYS.some((key) => (adjustments?.[key] ?? 0) !== 0)
)

/** The adjustments with one value changed; zeros are dropped, and none left is no adjustments. */
function next(change: Partial<ImageAdjustments>): ImageAdjustments | undefined {
  const merged: ImageAdjustments = { ...adjustments, ...change }
  const clean: ImageAdjustments = {}
  for (const key of IMAGE_ADJUSTMENT_KEYS) if (merged[key]) clean[key] = merged[key]
  if (merged.invert) clean.invert = true
  return Object.keys(clean).length > 0 ? clean : undefined
}

function set(key: Key, value: number[] | undefined) {
  const percentValue = value?.[0] ?? 0
  emit('update', next({ [key]: Math.max(-100, Math.min(100, percentValue)) / 100 }))
}
</script>

<template>
  <section class="space-y-1.5" data-test-id="image-adjustments">
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-semibold text-surface">{{ t.adjustments }}</span>
      <button
        v-if="edited"
        type="button"
        class="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
        data-test-id="image-adjustments-reset"
        @click="emit('update', undefined)"
      >
        {{ t.reset }}
      </button>
    </div>
    <div
      v-for="key in IMAGE_ADJUSTMENT_KEYS"
      :key="key"
      class="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-2 text-[11px]"
    >
      <label :for="`adjust-${key}`" class="truncate text-muted">{{ t[key] }}</label>
      <SliderRoot
        :id="`adjust-${key}`"
        :model-value="[percent(key)]"
        :min="-100"
        :max="100"
        :step="1"
        class="relative flex h-4 w-full touch-none items-center select-none"
        :data-adjustment="key"
        @update:model-value="set(key, $event)"
      >
        <SliderTrack class="relative h-1 grow rounded-full bg-hover">
          <SliderRange class="absolute h-full rounded-full bg-accent/60" />
        </SliderTrack>
        <SliderThumb
          :aria-label="t[key]"
          class="block size-3 rounded-full border border-border bg-panel shadow outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </SliderRoot>
      <span class="text-end tabular-nums text-muted" dir="ltr">{{ percent(key) }}</span>
    </div>
    <label class="flex items-center gap-2 text-[11px] text-muted">
      <input
        type="checkbox"
        :checked="!!adjustments?.invert"
        data-test-id="image-adjustments-invert"
        @change="emit('update', next({ invert: ($event.target as HTMLInputElement).checked }))"
      />
      {{ t.invert }}
    </label>
  </section>
</template>
