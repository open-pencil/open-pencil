<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

import { cleanAdjustments, hasAdjustments } from '@lawha/core/canvas'
import { IMAGE_ADJUSTMENT_KEYS, type ImageAdjustments, type ImageLevels } from '@lawha/scene-graph'
import { usePhotoMessages } from '@lawha/vue/i18n'

import CurveEditor from './CurveEditor.vue'

const { adjustments } = defineProps<{ adjustments: ImageAdjustments | undefined }>()
const emit = defineEmits<{ update: [adjustments: ImageAdjustments | undefined] }>()

const t = usePhotoMessages()

type Key = (typeof IMAGE_ADJUSTMENT_KEYS)[number]

/** Sliders show −100…100; the fill stores −1…1. */
const percent = (key: Key) => Math.round((adjustments?.[key] ?? 0) * 100)

const edited = computed(() => hasAdjustments(adjustments))

/** The adjustments with one value changed; no-op values are dropped, and none left is none. */
function next(change: Partial<ImageAdjustments>): ImageAdjustments | undefined {
  const clean = cleanAdjustments({ ...adjustments, ...change })
  return Object.keys(clean).length > 0 ? clean : undefined
}

const levels = computed<ImageLevels>(() => adjustments?.levels ?? { black: 0, white: 1, gamma: 1 })

/** Levels sliders: black and white 0…255; midtones −100…100 is gamma 0.1…10 on a log scale. */
const levelSliders = computed(() => [
  {
    key: 'black' as const,
    label: t.value.blackPoint,
    min: 0,
    max: 255,
    value: Math.round(levels.value.black * 255)
  },
  {
    key: 'white' as const,
    label: t.value.whitePoint,
    min: 0,
    max: 255,
    value: Math.round(levels.value.white * 255)
  },
  {
    key: 'gamma' as const,
    label: t.value.midtones,
    min: -100,
    max: 100,
    value: Math.round(Math.log10(levels.value.gamma) * 100)
  }
])

function setLevel(key: keyof ImageLevels, value: number[] | undefined) {
  const v = value?.[0] ?? 0
  const change: ImageLevels = { ...levels.value }
  if (key === 'gamma') change.gamma = Math.round(10 ** (v / 100) * 1000) / 1000
  else change[key] = v / 255
  if (change.white <= change.black) return
  emit('update', next({ levels: change }))
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
    <span class="block pt-1 text-[11px] font-semibold text-surface">{{ t.levels }}</span>
    <div
      v-for="slider in levelSliders"
      :key="slider.key"
      class="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-2 text-[11px]"
    >
      <span class="truncate text-muted">{{ slider.label }}</span>
      <SliderRoot
        :model-value="[slider.value]"
        :min="slider.min"
        :max="slider.max"
        :step="1"
        class="relative flex h-4 w-full touch-none items-center select-none"
        :data-level="slider.key"
        @update:model-value="setLevel(slider.key, $event)"
      >
        <SliderTrack class="relative h-1 grow rounded-full bg-hover">
          <SliderRange class="absolute h-full rounded-full bg-accent/60" />
        </SliderTrack>
        <SliderThumb
          :aria-label="slider.label"
          class="block size-3 rounded-full border border-border bg-panel shadow outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </SliderRoot>
      <span class="text-end tabular-nums text-muted" dir="ltr">{{ slider.value }}</span>
    </div>
    <div class="flex items-center justify-between pt-1">
      <span class="text-[11px] font-semibold text-surface">{{ t.curve }}</span>
      <button
        v-if="adjustments?.curve"
        type="button"
        class="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
        data-test-id="curve-reset"
        @click="emit('update', next({ curve: undefined }))"
      >
        {{ t.resetCurve }}
      </button>
    </div>
    <CurveEditor :points="adjustments?.curve" @update="emit('update', next({ curve: $event }))" />
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
